"""
Скрипт для экспорта логинов и паролей студентов в Excel
"""
import pandas as pd

# Читаем исходный Excel файл
df = pd.read_excel(r"C:\Users\cypre\Downloads\Telegram Desktop\База ученики.xlsx")

# Создаем новый DataFrame только с нужными колонками
# Колонка 0 - ФИО, Колонка 1 - Email, Колонка 2 - Пароль
output_df = pd.DataFrame({
    'ФИО': df.iloc[:, 0],
    'Логин (Email)': df.iloc[:, 1],
    'Пароль': df.iloc[:, 2]
})

# Удаляем строки с пустыми значениями
output_df = output_df.dropna(subset=['Логин (Email)', 'Пароль'])

# Экспортируем в Excel
output_path = r"C:\Users\cypre\Downloads\Telegram Desktop\Логины и пароли студентов.xlsx"
output_df.to_excel(output_path, index=False, engine='openpyxl')

print(f"Файл создан: {output_path}")
print(f"Всего студентов: {len(output_df)}")
