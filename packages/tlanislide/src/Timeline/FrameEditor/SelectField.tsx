export interface SelectFieldProps<T extends string[]> {
  label: string;
  value: string;
  options: T;
  onChange: (newValue: T[number]) => void;
}
export function SelectField<T extends string[]>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => {
          if (options.includes(e.target.value)) {
            onChange(e.target.value);
          }
        }}
      >
        <option value=""></option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
