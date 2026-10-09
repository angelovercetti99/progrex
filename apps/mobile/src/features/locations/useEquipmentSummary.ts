import type { LocationEquipment } from '@progrex/shared';
import { useTranslation } from 'react-i18next';

/** "Halteres (até 20 kg), Elásticos +1" — a one-line description of a place. */
export function useEquipmentSummary() {
  const { t } = useTranslation();

  return (equipment: LocationEquipment, maxItems = 2): string => {
    if (equipment.length === 0) {
      return t('locations.bodyweightOnly');
    }
    const labels = equipment.map((item) =>
      item.maxKg
        ? `${t(`equipment.${item.type}`)} (${t('locations.upTo')} ${item.maxKg} ${t('common.kg')})`
        : t(`equipment.${item.type}`)
    );
    const shown = labels.slice(0, maxItems).join(', ');
    const hidden = labels.length - maxItems;
    return hidden > 0 ? `${shown} ${t('locations.moreItems', { count: hidden })}` : shown;
  };
}
