'use client';

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

export function FieldInput({ label, value, onChange, placeholder, type = 'text' }: InputProps) {
  return (
    <label className="block relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="peer block w-full rounded-md border border-lp-border bg-white px-3 pt-5 pb-1 text-sm text-lp-text placeholder:text-gray-400 focus:border-lp-main focus:outline-none focus:ring-1 focus:ring-lp-main"
      />
      <span className="absolute top-1 left-3 text-[10px] leading-none text-lp-text-light pointer-events-none peer-focus:text-lp-main transition-colors">
        {label}
      </span>
    </label>
  );
}

interface TextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}

export function FieldTextarea({ label, value, onChange, placeholder, rows = 4, hint }: TextareaProps) {
  return (
    <label className="block relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="peer block w-full rounded-md border border-lp-border bg-white px-3 pt-5 pb-1 text-sm text-lp-text placeholder:text-gray-400 focus:border-lp-main focus:outline-none focus:ring-1 focus:ring-lp-main resize-y"
      />
      <span className="absolute top-1 left-3 bg-white pr-1 text-[10px] leading-none text-lp-text-light pointer-events-none peer-focus:text-lp-main transition-colors">
        {label}{hint && <span className="text-gray-400 ml-1">{hint}</span>}
      </span>
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function FieldSelect({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="block relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="peer block w-full rounded-md border border-lp-border bg-white px-3 pt-5 pb-1 text-sm text-lp-text focus:border-lp-main focus:outline-none focus:ring-1 focus:ring-lp-main"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="absolute top-1 left-3 text-[10px] leading-none text-lp-text-light pointer-events-none peer-focus:text-lp-main transition-colors">
        {label}
      </span>
    </label>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function FieldCheckbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-lp-border text-lp-main focus:ring-lp-main h-4 w-4"
      />
      <span className="text-sm text-lp-text">{label}</span>
    </label>
  );
}
