import React from 'react';

interface InputFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id: string;
  showToggle?: boolean;
  toggleState?: boolean;
  onToggle?: () => void;
  maxLength?: number;
  isFocused?: boolean;
  hasError?: boolean;
  hasSuccess?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  errorMessage?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  id,
  showToggle = false,
  toggleState,
  onToggle,
  maxLength,
  isFocused,
  hasError = false,
  hasSuccess = false,
  onFocus,
  onBlur,
  onKeyDown,
  errorMessage
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const inputType = showToggle && toggleState ? 'text' : type;

  const getBorderColor = () => {
    if (hasError) return 'border-red-500/50';
    if (hasSuccess) return 'border-green-500/50';
    if (isFocused) return 'border-indigo-400/50';
    return 'border-white/10';
  };

  const getShadow = () => {
    if (hasError) return 'shadow-[0_0_0_2px_rgba(239,68,68,0.15)]';
    if (hasSuccess) return 'shadow-[0_0_0_2px_rgba(34,197,94,0.15)]';
    if (isFocused) return 'shadow-[0_0_0_2px_rgba(99,102,241,0.15)]';
    return 'none';
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={`block text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
          hasError ? 'text-red-400' : hasSuccess ? 'text-green-400' : 'text-indigo-300'
        }`}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full px-5 py-4 bg-white/5 border rounded-xl text-white text-base outline-none transition-all duration-300 placeholder:text-slate-500 placeholder:text-base placeholder:opacity-60 ${getBorderColor()} ${getShadow()} hover:border-white/20 cursor-text`}
          style={{ lineHeight: '1.5' }}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {hasSuccess && !showToggle && !value && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-green-400 animate-[fadeIn_0.3s_ease-out]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {hasError && !showToggle && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-red-400 animate-[fadeIn_0.3s_ease-out]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-all duration-200 hover:scale-110"
            aria-label={toggleState ? '隐藏密码' : '显示密码'}
          >
            {toggleState
              ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.242M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            }
          </button>
        )}
      </div>
      {errorMessage && hasError && (
        <p className="text-xs text-red-400 pl-1 animate-[fadeIn_0.2s_ease-out] flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default InputField;