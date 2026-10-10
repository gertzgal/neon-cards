export interface SegmentedProps<V extends string | number> {
  testId: string
  label: string
  value: V
  options: readonly { value: V; label: string }[]
  onChange(value: V): void
}

export function Segmented<V extends string | number>({ testId, label, value, options, onChange }: SegmentedProps<V>) {
  return (
    <div className="field" data-testid={testId} data-value={value}>
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            data-testid={`${testId}-${option.value}`}
            className={option.value === value ? 'seg on' : 'seg'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({
  testId,
  label,
  on,
  onChange,
}: {
  testId: string
  label: string
  on: boolean
  onChange(on: boolean): void
}) {
  return (
    <Segmented
      testId={testId}
      label={label}
      value={on ? 'on' : 'off'}
      options={[
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ]}
      onChange={(value) => onChange(value === 'on')}
    />
  )
}
