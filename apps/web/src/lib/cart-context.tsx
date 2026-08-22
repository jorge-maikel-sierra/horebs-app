'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { trackAddToCart } from './analytics';

export type CartItem = {
  varianteId: string;
  productoNombre: string;
  varianteNombre: string;
  precio: number;
  cantidad: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'cantidad'>, cantidad?: number) => void;
  removeItem: (varianteId: string) => void;
  updateCantidad: (varianteId: string, cantidad: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'horebs-carrito';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage corrupto o no disponible — arrancamos con carrito vacío.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem: CartContextValue['addItem'] = (item, cantidad = 1) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.varianteId === item.varianteId);
      if (existente) {
        return prev.map((i) =>
          i.varianteId === item.varianteId
            ? { ...i, cantidad: i.cantidad + cantidad }
            : i,
        );
      }
      return [...prev, { ...item, cantidad }];
    });
    trackAddToCart(item, cantidad);
  };

  const removeItem: CartContextValue['removeItem'] = (varianteId) => {
    setItems((prev) => prev.filter((i) => i.varianteId !== varianteId));
  };

  const updateCantidad: CartContextValue['updateCantidad'] = (
    varianteId,
    cantidad,
  ) => {
    if (cantidad <= 0) {
      removeItem(varianteId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.varianteId === varianteId ? { ...i, cantidad } : i)),
    );
  };

  const clear = () => setItems([]);

  const total = useMemo(
    () => items.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
    [items],
  );
  const count = useMemo(
    () => items.reduce((acc, i) => acc + i.cantidad, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateCantidad, clear, total, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
