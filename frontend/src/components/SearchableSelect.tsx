import { useState, useRef, useEffect, useMemo } from "react";

export interface SearchableSelectOption {
  value: number | string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: (number | string)[] | number | string | null;
  onChange: (value: (number | string)[] | number | string | null) => void;
  placeholder?: string;
  multiSelect?: boolean;
  disabled?: boolean;
  className?: string;
}

// Simple fuzzy match function
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Direct substring match
  if (textLower.includes(queryLower)) return true;

  // Fuzzy match - check if all query chars exist in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Выберите...",
  multiSelect = false,
  disabled = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter(
      (option) =>
        fuzzyMatch(option.label, searchQuery) ||
        (option.description && fuzzyMatch(option.description, searchQuery))
    );
  }, [options, searchQuery]);

  // Get selected values as array
  const selectedValues = useMemo(() => {
    if (multiSelect) {
      return (value as (number | string)[]) || [];
    }
    return value != null ? [value as number | string] : [];
  }, [value, multiSelect]);

  // Get display text for selected values
  const displayText = useMemo(() => {
    if (selectedValues.length === 0) return "";
    if (multiSelect) {
      const count = selectedValues.length;
      if (count === 1) {
        const option = options.find((o) => o.value === selectedValues[0]);
        return option?.label || "";
      }
      return `Выбрано: ${count}`;
    }
    const option = options.find((o) => o.value === selectedValues[0]);
    return option?.label || "";
  }, [selectedValues, options, multiSelect]);

  const handleToggleOption = (optionValue: number | string) => {
    if (multiSelect) {
      const currentValues = (value as (number | string)[]) || [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((v) => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiSelect ? [] : null);
    setSearchQuery("");
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className={`input w-full flex items-center justify-between cursor-pointer ${
          disabled ? "bg-gray-100 cursor-not-allowed" : ""
        } ${isOpen ? "ring-2 ring-cyan-500 border-cyan-500" : ""}`}
      >
        <span className={displayText ? "text-gray-800" : "text-gray-400"}>
          {displayText || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Поиск..."
                autoFocus
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                Ничего не найдено
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleToggleOption(option.value)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-cyan-50" : ""
                    }`}
                  >
                    {multiSelect && (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-cyan-500 border-cyan-500"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${isSelected && !multiSelect ? "text-cyan-600 font-medium" : "text-gray-800"}`}>
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-xs text-gray-400 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>
                    {!multiSelect && isSelected && (
                      <svg className="w-4 h-4 text-cyan-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Selected count for multiselect */}
          {multiSelect && selectedValues.length > 0 && (
            <div className="p-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              Выбрано: {selectedValues.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
