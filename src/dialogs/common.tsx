import type { ReactNode } from 'react';

export function Select({ id, value, onChange, options }: { id: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {children}
    </>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}
