import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryIcon } from './category-icon';

export interface SheetOption {
  value: string;
  label: string;
  description?: string | undefined;
  icon?: string | null | undefined;
  color?: string | null | undefined;
  /** Indents subcategories. */
  nested?: boolean | undefined;
}

/** Full-screen list to pick one option (accounts, categories...). */
export function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selected?: string | null | undefined;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-2">
          <Text accessibilityRole="header" className="text-lg font-semibold text-foreground">
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            className="size-11 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#64748b" />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(option) => option.value}
          renderItem={({ item }) => {
            const isSelected = item.value === selected;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={item.label}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${item.nested ? 'pl-12' : ''} ${isSelected ? 'bg-muted' : ''}`}
              >
                {item.icon !== undefined || item.color !== undefined ? (
                  <CategoryIcon icon={item.icon} color={item.color} size={item.nested ? 28 : 36} />
                ) : null}
                <View className="flex-1">
                  <Text className="text-base text-foreground">{item.label}</Text>
                  {item.description ? (
                    <Text className="text-xs text-muted-foreground">{item.description}</Text>
                  ) : null}
                </View>
                {isSelected ? <Ionicons name="checkmark" size={20} color="#0f766e" /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
