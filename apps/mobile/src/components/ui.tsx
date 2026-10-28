import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';

const BUTTON: Record<ButtonVariant, { box: string; text: string }> = {
  primary: { box: 'bg-primary', text: 'text-primary-foreground' },
  outline: { box: 'border border-border bg-card', text: 'text-foreground' },
  ghost: { box: '', text: 'text-foreground' },
  destructive: { box: 'bg-destructive', text: 'text-destructive-foreground' },
};

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}

/** Touch target of at least 44 px; the label is also the accessible name. */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  const style = BUTTON[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inactive), busy: loading }}
      disabled={inactive}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-lg px-4 ${style.box} ${inactive ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading ? <ActivityIndicator /> : icon}
      <Text className={`text-base font-semibold ${style.text}`}>{label}</Text>
    </Pressable>
  );
}

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null | undefined;
  hint?: string | undefined;
}

export function TextField({ label, error, hint, className = '', ...props }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        className={`min-h-12 rounded-lg border px-3 text-base text-foreground ${error ? 'border-destructive' : 'border-input'} ${className}`}
        {...props}
      />
      {hint && !error ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Selectable pill used for filters and quick choices. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-11 flex-row items-center gap-1.5 rounded-full border px-4 ${selected ? 'border-primary bg-primary' : 'border-border bg-card'}`}
    >
      {icon}
      <Text
        className={`text-sm font-medium ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" className="text-lg font-semibold text-foreground">
      {children}
    </Text>
  );
}

/** Segmented control (e.g. Gasto / Ingreso). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            className={`min-h-11 flex-1 items-center justify-center rounded-md ${selected ? 'bg-card' : ''}`}
          >
            <Text
              className={`text-sm font-semibold ${selected ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
