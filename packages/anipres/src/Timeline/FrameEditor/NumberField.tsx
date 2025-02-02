import { useCallback } from "react";

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (newValue: number) => void;
}
export function NumberField({ label, value, onChange }: NumberFieldProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === "") {
        onChange(0);
        return;
      }
      const intVal = parseInt(e.target.value);
      if (!isNaN(intVal)) {
        onChange(intVal);
      }
    },
    [onChange],
  );
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={handleChange} />
    </label>
  );
}
