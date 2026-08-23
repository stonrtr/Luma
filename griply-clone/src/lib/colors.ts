export interface NamedColor {
  name: string;
  hex: string;
}

export const PALETTE: NamedColor[] = [
  { name: "Алое пламя", hex: "#e5484d" },
  { name: "Клубничный сорбет", hex: "#f2545b" },
  { name: "Нежно-розовый", hex: "#f4a9b8" },
  { name: "Цитрусовый жар", hex: "#f76b15" },
  { name: "Закатный коралл", hex: "#ff8b64" },
  { name: "Тёплый персик", hex: "#f5b087" },
  { name: "Золотые бархатцы", hex: "#f5a623" },
  { name: "Солнечное золото", hex: "#ffc53d" },
  { name: "Медовое сияние", hex: "#ffd88a" },
  { name: "Зелёная листва", hex: "#46a758" },
  { name: "Пряный шалфей", hex: "#87b573" },
  { name: "Морозная мята", hex: "#aedbc0" },
  { name: "Океанский бирюзовый", hex: "#12a594" },
  { name: "Морская дымка", hex: "#63c7b2" },
  { name: "Мятный шёпот", hex: "#b6e5d3" },
  { name: "Электрический сапфир", hex: "#0d74ce" },
  { name: "Лазурная волна", hex: "#3b9eff" },
  { name: "Небесный бриз", hex: "#7cc0f5" },
  { name: "Королевский аметист", hex: "#8347b9" },
  { name: "Яркий барвинок", hex: "#6e6ade" },
  { name: "Прохладное небо", hex: "#a5b4f0" },
  { name: "Роза фуксия", hex: "#d6409f" },
  { name: "Сладкая вата", hex: "#ef8bc7" },
  { name: "Лепестковый розовый", hex: "#f6c6dd" },
  { name: "Полуночный индиго", hex: "#3d3a94" },
];

export function colorByName(name: string | null | undefined): string | null {
  if (!name) return null;
  const c = PALETTE.find((p) => p.name === name);
  return c ? c.hex : name; // допускаем и «сырой» hex
}
