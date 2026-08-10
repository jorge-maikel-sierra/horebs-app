export type GoogleReview = {
  id: string;
  author: string;
  authorPhoto: string | null;
  authorProfileUrl: string | null;
  rating: number;
  texto: string;
  tiempoRelativo: string;
};

type PlaceDetailsResponse = {
  reviews?: {
    name: string;
    rating: number;
    text?: { text: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: {
      displayName?: string;
      photoUri?: string;
      uri?: string;
    };
  }[];
  rating?: number;
  userRatingCount?: number;
};

export type GoogleReviewsData = {
  reviews: GoogleReview[];
  rating: number | null;
  totalReseñas: number | null;
};

const VACIO: GoogleReviewsData = { reviews: [], rating: null, totalReseñas: null };

/**
 * Trae reseñas reales desde la Places API (New) de Google. Requiere
 * GOOGLE_PLACES_API_KEY y GOOGLE_PLACE_ID en el entorno del servidor — si
 * faltan o la API falla, devuelve vacío y el caller debe mostrar el
 * fallback estático (no hay datos inventados en ningún punto de esta
 * función).
 *
 * La API solo devuelve hasta 5 reseñas por diseño (no es paginable), y sus
 * Términos de Servicio exigen no cachear el contenido indefinidamente —
 * por eso el revalidate cada hora en vez de cache: 'no-store' (evita
 * pegarle a la API en cada request, que además tiene costo por llamada).
 */
export async function getGoogleReviews(): Promise<GoogleReviewsData> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) return VACIO;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
        },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return VACIO;

    const data: PlaceDetailsResponse = await res.json();
    const reviews = (data.reviews ?? [])
      .filter((r) => r.text?.text)
      .map((r) => ({
        id: r.name,
        author: r.authorAttribution?.displayName ?? 'Cliente de Google',
        authorPhoto: r.authorAttribution?.photoUri ?? null,
        authorProfileUrl: r.authorAttribution?.uri ?? null,
        rating: r.rating,
        texto: r.text!.text,
        tiempoRelativo: r.relativePublishTimeDescription ?? '',
      }));

    return {
      reviews,
      rating: data.rating ?? null,
      totalReseñas: data.userRatingCount ?? null,
    };
  } catch {
    return VACIO;
  }
}
