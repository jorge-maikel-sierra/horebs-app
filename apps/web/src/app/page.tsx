import ApiStatus from '@/components/ApiStatus';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Pizzería Horebs
      </h1>
      <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
        Base del nuevo sitio. Esta página solo confirma que el frontend, el API y
        Supabase están conectados — el catálogo, carrito y checkout reales se
        construyen a partir de aquí.
      </p>
      <ApiStatus />
    </div>
  );
}
