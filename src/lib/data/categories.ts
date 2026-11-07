import {
  Briefcase01Icon,
  CashierIcon,
  CleaningBucketIcon,
  ConstructionIcon,
  Factory01Icon,
  ForkliftIcon,
  PackageIcon,
  Restaurant01Icon,
  SaleTag01Icon,
  Shield01Icon,
  TruckDeliveryIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import type { CategoryId } from "./types";

export const CATEGORIES: { id: CategoryId; label: string; icon: typeof Factory01Icon }[] = [
  { id: "produccion", label: "Producción", icon: Factory01Icon },
  { id: "almacen", label: "Almacén", icon: PackageIcon },
  { id: "montacargas", label: "Montacargas", icon: ForkliftIcon },
  { id: "chofer", label: "Chofer y reparto", icon: TruckDeliveryIcon },
  { id: "restaurante", label: "Restaurantes", icon: Restaurant01Icon },
  { id: "caja", label: "Caja y tienda", icon: CashierIcon },
  { id: "ventas", label: "Ventas", icon: SaleTag01Icon },
  { id: "limpieza", label: "Limpieza", icon: CleaningBucketIcon },
  { id: "mantenimiento", label: "Mantenimiento", icon: Wrench01Icon },
  { id: "construccion", label: "Construcción", icon: ConstructionIcon },
  { id: "seguridad", label: "Seguridad", icon: Shield01Icon },
  { id: "oficina", label: "Oficina", icon: Briefcase01Icon },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>;
