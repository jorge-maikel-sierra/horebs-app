# Síntesis de investigación: reseñas de Google

**Método:** análisis de reseñas públicas | **Muestra:** 5 reseñas (límite de la Places API) + promedio 4.7 sobre 144 reseñas
**Fecha:** octubre de 2026 | **Fuente:** sección "Clientes felices" de la home (Places API, `lib/google-reviews.ts`)

## Resumen

Los clientes valoran sobre todo **la masa crocante y la cantidad de queso**, y en segundo lugar **la rapidez del domicilio**. La única reseña negativa también habla del domicilio: un pedido equivocado, quemado y sin respuesta posterior. El domicilio es a la vez lo que más se elogia y lo que más se critica, así que la home tiene que dar seguridad sobre cómo llega y cómo se confirma el pedido.

## Temas

### 1. Masa y queso
**Frecuencia:** 3 de 5
- "Masa delgada y crocante con mucho queso, deliciosa." (5★)
- "Súper ricas… los ingredientes son muy buenos." (5★)
- "Es muy rica la comida, es mi pizeria favorita" (5★)

**Implicación:** los clientes dicen "crocante", no "crujiente". La home usaba "crujiente" en el hero y en el footer.

### 2. Domicilio rápido
**Frecuencia:** 2 de 5 a favor, 1 de 5 en contra
- "La atención y el domicilio es rápido." (5★)
- "El servicio a domicilio es muy bueno." (5★)
- "No cuidan como llegan las pizzas y no le vuelven a responder a uno." (1★)

**Implicación:** las dudas sobre el domicilio (costo, confirmación, qué hacer si algo sale mal) tienen que aparecer primero en la FAQ.

### 3. Fidelidad
**Frecuencia:** 2 de 5 ("Volvere a comprar!", "es mi pizeria favorita")

**Implicación:** la sección de testimonios funciona como prueba social para quien todavía no pidió.

## Insights y cambios aplicados

| Insight | Cambio en la home | Impacto | Esfuerzo |
|---|---|---|---|
| Los clientes dicen "crocante" | Hero, palabra rotativa y footer pasan a "crocante" | Medio | Bajo |
| El queso es un diferencial que mencionan solos | El hero dice "bien cargada de queso" | Medio | Bajo |
| El domicilio genera dudas | La FAQ abre con domicilio, costo ($5.000), pagos, horario y confirmación | Alto | Bajo |
| La FAQ decía que el costo "varía según la zona" | Se corrigió al costo fijo real ($5.000, `COSTO_DOMICILIO_DEFAULT`) | Alto | Bajo |
| Un 1★ aparecía en la sección "Clientes felices" | La sección muestra solo reseñas de 4–5★; el promedio y el enlace a todas las reseñas siguen visibles | Alto | Bajo |

## Preguntas abiertas

- ¿Qué tan seguido falla el domicilio? Cruzar con pedidos cancelados y reclamos por WhatsApp.
- ¿Hay seguimiento del pedido después de confirmarlo? Si existe, conviene contarlo en la FAQ.
- Con más de 5 reseñas (exportadas desde Google Business Profile) los temas serían más confiables.

## Limitaciones

La muestra es chica (5 reseñas, las que elige Google como "más relevantes") y no representa a las 144. Sirve para orientar el copy, no para sacar conclusiones operativas.
