import { useState } from 'react';
import { Input, Textarea, type InputProps, type TextareaProps } from '@/components/ui';
import { autoTranslate } from '@/lib/translate';

interface TranslatableInputProps extends Omit<InputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  sourceText: string;
  sourceLang?: string;
  targetLang: string;
}

interface TranslatableTextareaProps extends Omit<TextareaProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  sourceText: string;
  sourceLang?: string;
  targetLang: string;
}

function AutoButton({
  loading,
  onClick,
  className = '',
}: {
  loading: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`float-field-action-btn ${className}`}
      title="Türkçe metinden otomatik çevir"
    >
      {loading ? '…' : 'Çeviri'}
    </button>
  );
}

function useAutoTranslate(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  onChange: (value: string) => void
) {
  const [loading, setLoading] = useState(false);
  const showAuto = targetLang !== sourceLang && targetLang !== 'tr';

  async function handleAuto() {
    if (!sourceText.trim()) {
      window.alert('Önce Türkçe alanı doldurun');
      return;
    }
    setLoading(true);
    try {
      const translated = await autoTranslate(sourceText.trim(), sourceLang, targetLang);
      onChange(translated);
    } catch {
      window.alert('Çeviri yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return { loading, showAuto, handleAuto };
}

export function TranslatableInput({
  value,
  onChange,
  sourceText,
  sourceLang = 'tr',
  targetLang,
  className = '',
  ...props
}: TranslatableInputProps) {
  const { loading, showAuto, handleAuto } = useAutoTranslate(
    sourceText,
    sourceLang,
    targetLang,
    onChange
  );

  if (!showAuto) {
    return (
      <Input
        {...props}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={`float-field-action-wrap ${className}`}>
      <Input
        {...props}
        className="float-field-action-wrap__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <AutoButton loading={loading} onClick={handleAuto} />
    </div>
  );
}

export function TranslatableTextarea({
  value,
  onChange,
  sourceText,
  sourceLang = 'tr',
  targetLang,
  className = '',
  ...props
}: TranslatableTextareaProps) {
  const { loading, showAuto, handleAuto } = useAutoTranslate(
    sourceText,
    sourceLang,
    targetLang,
    onChange
  );

  if (!showAuto) {
    return (
      <Textarea
        {...props}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={`float-field-action-wrap float-field-action-wrap--textarea ${className}`}>
      <Textarea
        {...props}
        className="float-field-action-wrap__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <AutoButton loading={loading} onClick={handleAuto} className="float-field-action-btn--top" />
    </div>
  );
}
