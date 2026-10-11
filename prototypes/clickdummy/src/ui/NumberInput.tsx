import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react'
import { formatDecimal } from '@/domain/format'
import { cx } from './cx'
import { controlClass, parseNumber } from './form'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onValue(v: number): void
  decimals?: number
}

/** Zahleneingabe, die deutsche Schreibweise (1.234,5) akzeptiert und live übernimmt. */
export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput({ value, onValue, decimals = 2, className, ...rest }, ref) {
  const format = (n: number) => formatDecimal(n, decimals).replace(/\./g, '')
  const [draft, setDraft] = useState(format(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, decimals])

  return (
    <input
      ref={ref}
      inputMode="decimal"
      value={draft}
      onFocus={(e) => { setFocused(true); e.currentTarget.select() }}
      onBlur={() => setFocused(false)}
      onChange={(e) => { setDraft(e.target.value); onValue(parseNumber(e.target.value)) }}
      className={cx(controlClass(), 'h-8 text-right', className)}
      {...rest}
    />
  )
})
