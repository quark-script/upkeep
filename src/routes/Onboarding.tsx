import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { KEYS } from '../lib/storage'
import { Btn, Divider } from '../components/ui'
import type { Profile, MeasurementEntry } from '../lib/types'

// ─── Steps ────────────────────────────────────────────────────────────────────

type Step = 'name' | 'baseline'

function numInput(
  label: string,
  unit: string,
  value: string,
  onChange: (v: string) => void,
) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] text-text-dim uppercase tracking-[0.06em]">{label}</label>
      <div className="flex items-center gap-2 bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-3.5 py-3">
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="—"
          className="flex-1 bg-transparent border-none outline-none font-mono text-[18px] text-text min-w-0"
        />
        <span className="font-mono text-[11px] text-text-faint uppercase shrink-0">{unit}</span>
      </div>
    </div>
  )
}

// ─── Step 1 — Name ────────────────────────────────────────────────────────────

function NameStep({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState('')
  const valid = name.trim().length > 0

  return (
    <div className="flex flex-col flex-1 justify-between">
      <div>
        <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em] mb-3">Step 1 of 2</p>
        <h1 className="font-serif text-[36px] leading-[40px] font-medium text-text tracking-[-0.05em] mb-2">
          What's your name?
        </h1>
        <p className="font-sans text-[14px] text-text-dim leading-[21px] mb-8">
          GainZ is a personal tracker — it'll greet you by name every morning.
        </p>

        <input
          type="text"
          value={name}
          autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && valid && onNext(name.trim())}
          placeholder="Your first name"
          className="w-full bg-panel-inset border border-[var(--color-panel-border)] rounded-card px-4 py-3.5 font-serif text-[22px] text-text outline-none placeholder:text-text-faint focus:border-accent transition-colors"
        />
      </div>

      <Btn fullWidth disabled={!valid} onClick={() => onNext(name.trim())}>
        Continue
      </Btn>
    </div>
  )
}

// ─── Step 2 — Baseline ────────────────────────────────────────────────────────

type BaselineForm = {
  weight: string
  bodyFat: string
  muscleMass: string
  chest: string
  waist: string
  thigh: string
}

function BaselineStep({ name, onDone }: { name: string; onDone: (m: MeasurementEntry | null) => void }) {
  const [form, setForm] = useState<BaselineForm>({
    weight: '', bodyFat: '', muscleMass: '',
    chest: '', waist: '', thigh: '',
  })
  const set = (k: keyof BaselineForm) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  function buildEntry(): MeasurementEntry | null {
    const w = parseFloat(form.weight)
    if (isNaN(w) || w <= 0) return null
    return {
      date: new Date().toISOString().split('T')[0],
      weight:     w,
      bodyFat:    parseFloat(form.bodyFat)    || 0,
      muscleMass: parseFloat(form.muscleMass) || 0,
      bmi: 0,
      bmr: 0,
      measurements: {
        neck: 0, shoulder: 0,
        chest:  parseFloat(form.chest)  || 0,
        biceps: 0, forearm: 0,
        upperAbdomen: 0, lowerAbdomen: 0,
        waist:  parseFloat(form.waist)  || 0,
        hips: 0,
        thigh:  parseFloat(form.thigh)  || 0,
        calf: 0,
      },
    }
  }

  return (
    <div className="flex flex-col flex-1 justify-between gap-6">
      <div>
        <p className="font-mono text-[11px] text-text-dim uppercase tracking-[0.14em] mb-3">Step 2 of 2</p>
        <h1 className="font-serif text-[36px] leading-[40px] font-medium text-text tracking-[-0.05em] mb-2">
          Starting point,<br />{name}.
        </h1>
        <p className="font-sans text-[14px] text-text-dim leading-[21px] mb-6">
          Log your baseline measurements. Only weight is required — you can fill the rest in later.
        </p>

        <div className="flex flex-col gap-5">
          <div>
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mb-3">Body</p>
            <div className="grid grid-cols-3 gap-2.5">
              {numInput('Weight *', 'kg', form.weight, set('weight'))}
              {numInput('Body fat', '%',  form.bodyFat, set('bodyFat'))}
              {numInput('Muscle', 'kg',   form.muscleMass, set('muscleMass'))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-[0.08em] mb-3">Tape (inches)</p>
            <div className="grid grid-cols-3 gap-2.5">
              {numInput('Chest', '″',  form.chest, set('chest'))}
              {numInput('Waist', '″',  form.waist, set('waist'))}
              {numInput('Thigh', '″',  form.thigh, set('thigh'))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {(() => { const entry = buildEntry(); return (
          <Btn fullWidth onClick={() => onDone(entry)}>
            {entry ? 'Save & start tracking' : 'Skip for now'}
          </Btn>
        )})()}
        <button
          onClick={() => onDone(null)}
          className="w-full py-2.5 bg-transparent border-none font-sans text-[12px] text-text-dim uppercase tracking-[0.06em] cursor-pointer"
        >
          Skip baseline
        </button>
      </div>
    </div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface OnboardingProps {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [, setProfile]      = useLocalStorage<Profile | null>(KEYS.PROFILE, null)
  const [, setMeasurements] = useLocalStorage<MeasurementEntry[]>(KEYS.MEASUREMENTS, [])

  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')

  function handleName(n: string) {
    setName(n)
    setStep('baseline')
  }

  function handleDone(measurement: MeasurementEntry | null) {
    setProfile({ name })
    if (measurement) {
      setMeasurements([measurement])
    }
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-vault flex flex-col">
      <div className="flex-1 max-w-[480px] mx-auto w-full px-6 pt-16 pb-10 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12">
          <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center shrink-0">
            <span className="font-mono font-bold text-sm text-accent-text leading-none">GZ</span>
          </div>
          <span className="font-serif text-xl text-text tracking-tight">GainZ</span>
        </div>

        {step === 'name'     && <NameStep     onNext={handleName} />}
        {step === 'baseline' && <BaselineStep name={name} onDone={handleDone} />}
      </div>
    </div>
  )
}
