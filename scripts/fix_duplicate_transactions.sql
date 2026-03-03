-- =============================================================================
-- Скрипт коррекции дублированных транзакций
-- Дата: 2026-03-03
-- Причина: race condition при отметке посещаемости (двойной клик / concurrent requests)
-- =============================================================================
-- ВАЖНО: Выполнять на production (ssh jsi → docker exec -it engcrm-db-1 psql -U engcrm engcrm)
-- Рекомендуется сделать бэкап БД перед запуском!
-- =============================================================================

-- =============================================
-- ЧАСТЬ 1: АНАЛИЗ (dry-run, только SELECT)
-- =============================================

-- 1.1. Дубликаты DEBIT (списания со студентов)
-- Показывает все lesson_id + user_id с более чем 1 DEBIT-транзакцией
SELECT
    t.user_id,
    u.name AS student_name,
    t.lesson_id,
    l.title AS lesson_title,
    COUNT(*) AS tx_count,
    SUM(t.amount) AS total_debited,
    MIN(t.amount) AS single_amount,
    SUM(t.amount) - MIN(t.amount) AS overpaid
FROM transactions t
JOIN users u ON u.id = t.user_id
LEFT JOIN lessons l ON l.id = t.lesson_id
WHERE t.type = 'debit'
  AND t.lesson_id IS NOT NULL
GROUP BY t.user_id, t.lesson_id, u.name, l.title
HAVING COUNT(*) > 1
ORDER BY SUM(t.amount) - MIN(t.amount) DESC;

-- 1.2. Итого переплата студентов
SELECT
    COUNT(*) AS duplicate_groups,
    SUM(overpaid) AS total_overpaid
FROM (
    SELECT
        t.user_id,
        t.lesson_id,
        SUM(t.amount) - MIN(t.amount) AS overpaid
    FROM transactions t
    WHERE t.type = 'debit'
      AND t.lesson_id IS NOT NULL
    GROUP BY t.user_id, t.lesson_id
    HAVING COUNT(*) > 1
) sub;

-- 1.3. Дубликаты CREDIT (переплата учителям)
SELECT
    t.user_id,
    u.name AS teacher_name,
    t.lesson_id,
    l.title AS lesson_title,
    COUNT(*) AS tx_count,
    SUM(t.amount) AS total_credited,
    MIN(t.amount) AS single_amount,
    SUM(t.amount) - MIN(t.amount) AS overpaid
FROM transactions t
JOIN users u ON u.id = t.user_id
LEFT JOIN lessons l ON l.id = t.lesson_id
WHERE t.type = 'credit'
  AND t.lesson_id IS NOT NULL
  AND u.role = 'teacher'
GROUP BY t.user_id, t.lesson_id, u.name, l.title
HAVING COUNT(*) > 1
ORDER BY SUM(t.amount) - MIN(t.amount) DESC;

-- 1.4. Итого переплата учителям
SELECT
    COUNT(*) AS duplicate_groups,
    SUM(overpaid) AS total_overpaid_teachers
FROM (
    SELECT
        t.user_id,
        t.lesson_id,
        SUM(t.amount) - MIN(t.amount) AS overpaid
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'credit'
      AND t.lesson_id IS NOT NULL
      AND u.role = 'teacher'
    GROUP BY t.user_id, t.lesson_id
    HAVING COUNT(*) > 1
) sub;

-- 1.5. ID транзакций к удалению (DEBIT дубликаты — все кроме первой)
SELECT t.id, t.user_id, t.lesson_id, t.amount, t.type, t.created_at, t.description
FROM transactions t
WHERE t.type = 'debit'
  AND t.lesson_id IS NOT NULL
  AND t.id NOT IN (
      -- Оставляем только первую (MIN id) транзакцию в каждой группе
      SELECT MIN(t2.id)
      FROM transactions t2
      WHERE t2.type = 'debit'
        AND t2.lesson_id IS NOT NULL
      GROUP BY t2.user_id, t2.lesson_id
  )
  AND EXISTS (
      -- Только из групп с дубликатами
      SELECT 1
      FROM transactions t3
      WHERE t3.user_id = t.user_id
        AND t3.lesson_id = t.lesson_id
        AND t3.type = 'debit'
      GROUP BY t3.user_id, t3.lesson_id
      HAVING COUNT(*) > 1
  )
ORDER BY t.user_id, t.lesson_id, t.id;

-- 1.6. ID транзакций к удалению (CREDIT дубликаты учителей)
SELECT t.id, t.user_id, t.lesson_id, t.amount, t.type, t.created_at, t.description
FROM transactions t
JOIN users u ON u.id = t.user_id
WHERE t.type = 'credit'
  AND t.lesson_id IS NOT NULL
  AND u.role = 'teacher'
  AND t.id NOT IN (
      SELECT MIN(t2.id)
      FROM transactions t2
      JOIN users u2 ON u2.id = t2.user_id
      WHERE t2.type = 'credit'
        AND t2.lesson_id IS NOT NULL
        AND u2.role = 'teacher'
      GROUP BY t2.user_id, t2.lesson_id
  )
  AND EXISTS (
      SELECT 1
      FROM transactions t3
      JOIN users u3 ON u3.id = t3.user_id
      WHERE t3.user_id = t.user_id
        AND t3.lesson_id = t.lesson_id
        AND t3.type = 'credit'
        AND u3.role = 'teacher'
      GROUP BY t3.user_id, t3.lesson_id
      HAVING COUNT(*) > 1
  )
ORDER BY t.user_id, t.lesson_id, t.id;


-- =============================================
-- ЧАСТЬ 2: КОРРЕКЦИЯ (выполнять после проверки ЧАСТИ 1)
-- =============================================

BEGIN;

-- 2.1. Возврат переплаты студентам (увеличение баланса)
-- Для каждого студента суммируем amount дублированных DEBIT-транзакций
UPDATE users
SET balance = balance + correction.overpaid
FROM (
    SELECT
        t.user_id,
        SUM(t.amount) AS overpaid
    FROM transactions t
    WHERE t.type = 'debit'
      AND t.lesson_id IS NOT NULL
      AND t.id NOT IN (
          SELECT MIN(t2.id)
          FROM transactions t2
          WHERE t2.type = 'debit'
            AND t2.lesson_id IS NOT NULL
          GROUP BY t2.user_id, t2.lesson_id
      )
      AND EXISTS (
          SELECT 1
          FROM transactions t3
          WHERE t3.user_id = t.user_id
            AND t3.lesson_id = t.lesson_id
            AND t3.type = 'debit'
          GROUP BY t3.user_id, t3.lesson_id
          HAVING COUNT(*) > 1
      )
    GROUP BY t.user_id
) correction
WHERE users.id = correction.user_id;

-- 2.2. Удаление дублированных DEBIT-транзакций (оставляем первую)
DELETE FROM transactions
WHERE type = 'debit'
  AND lesson_id IS NOT NULL
  AND id NOT IN (
      SELECT MIN(t2.id)
      FROM transactions t2
      WHERE t2.type = 'debit'
        AND t2.lesson_id IS NOT NULL
      GROUP BY t2.user_id, t2.lesson_id
  )
  AND EXISTS (
      SELECT 1
      FROM transactions t3
      WHERE t3.user_id = transactions.user_id
        AND t3.lesson_id = transactions.lesson_id
        AND t3.type = 'debit'
      GROUP BY t3.user_id, t3.lesson_id
      HAVING COUNT(*) > 1
  );

-- 2.3. Снятие переплаты с учителей (уменьшение баланса)
UPDATE users
SET balance = balance - correction.overpaid
FROM (
    SELECT
        t.user_id,
        SUM(t.amount) AS overpaid
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'credit'
      AND t.lesson_id IS NOT NULL
      AND u.role = 'teacher'
      AND t.id NOT IN (
          SELECT MIN(t2.id)
          FROM transactions t2
          JOIN users u2 ON u2.id = t2.user_id
          WHERE t2.type = 'credit'
            AND t2.lesson_id IS NOT NULL
            AND u2.role = 'teacher'
          GROUP BY t2.user_id, t2.lesson_id
      )
      AND EXISTS (
          SELECT 1
          FROM transactions t3
          JOIN users u3 ON u3.id = t3.user_id
          WHERE t3.user_id = t.user_id
            AND t3.lesson_id = t.lesson_id
            AND t3.type = 'credit'
            AND u3.role = 'teacher'
          GROUP BY t3.user_id, t3.lesson_id
          HAVING COUNT(*) > 1
      )
    GROUP BY t.user_id
) correction
WHERE users.id = correction.user_id;

-- 2.4. Удаление дублированных CREDIT-транзакций учителей (оставляем первую)
DELETE FROM transactions
WHERE type = 'credit'
  AND lesson_id IS NOT NULL
  AND id IN (
      SELECT t.id
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      WHERE t.type = 'credit'
        AND t.lesson_id IS NOT NULL
        AND u.role = 'teacher'
        AND t.id NOT IN (
            SELECT MIN(t2.id)
            FROM transactions t2
            JOIN users u2 ON u2.id = t2.user_id
            WHERE t2.type = 'credit'
              AND t2.lesson_id IS NOT NULL
              AND u2.role = 'teacher'
            GROUP BY t2.user_id, t2.lesson_id
        )
        AND EXISTS (
            SELECT 1
            FROM transactions t3
            JOIN users u3 ON u3.id = t3.user_id
            WHERE t3.user_id = t.user_id
              AND t3.lesson_id = t.lesson_id
              AND t3.type = 'credit'
              AND u3.role = 'teacher'
            GROUP BY t3.user_id, t3.lesson_id
            HAVING COUNT(*) > 1
        )
  );

-- =============================================
-- ЧАСТЬ 3: ПРОВЕРКА (выполнить перед COMMIT)
-- =============================================

-- 3.1. Проверка: не осталось дубликатов DEBIT
SELECT COUNT(*) AS remaining_debit_duplicates
FROM (
    SELECT user_id, lesson_id
    FROM transactions
    WHERE type = 'debit' AND lesson_id IS NOT NULL
    GROUP BY user_id, lesson_id
    HAVING COUNT(*) > 1
) sub;

-- 3.2. Проверка: не осталось дубликатов CREDIT у учителей
SELECT COUNT(*) AS remaining_credit_duplicates
FROM (
    SELECT t.user_id, t.lesson_id
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'credit' AND t.lesson_id IS NOT NULL AND u.role = 'teacher'
    GROUP BY t.user_id, t.lesson_id
    HAVING COUNT(*) > 1
) sub;

-- 3.3. Проверка балансов: текущий баланс vs расчётный по транзакциям
-- (показывает расхождения > 1 тг)
SELECT
    u.id,
    u.name,
    u.role,
    u.balance AS current_balance,
    COALESCE(calc.calculated_balance, 0) AS calculated_balance,
    u.balance - COALESCE(calc.calculated_balance, 0) AS difference
FROM users u
LEFT JOIN (
    SELECT
        user_id,
        SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS calculated_balance
    FROM transactions
    GROUP BY user_id
) calc ON calc.user_id = u.id
WHERE ABS(u.balance - COALESCE(calc.calculated_balance, 0)) > 1
ORDER BY ABS(u.balance - COALESCE(calc.calculated_balance, 0)) DESC;

-- Если всё корректно:
-- COMMIT;

-- Если что-то не так:
-- ROLLBACK;
