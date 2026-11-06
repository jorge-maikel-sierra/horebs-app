/**
 * Ejecuta las tareas de una misma clave de a una, en orden de llegada;
 * claves distintas corren en paralelo.
 *
 * Se usa por conversación: si un cliente manda varios mensajes seguidos, cada
 * uno se procesaba a la vez con el mismo historial de Gemini y salían dos
 * respuestas que se contradecían. En memoria alcanza porque Railway corre un
 * solo proceso de la API; con varias réplicas haría falta un lock en la base.
 */
export class ColaPorClave {
  private readonly pendientes = new Map<string, Promise<unknown>>();

  ejecutar<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
    const anterior = this.pendientes.get(clave) ?? Promise.resolve();
    // Un fallo de la tarea anterior no frena a la siguiente.
    const actual = anterior.catch(() => undefined).then(tarea);
    this.pendientes.set(clave, actual);
    const limpiar = (): void => {
      if (this.pendientes.get(clave) === actual) this.pendientes.delete(clave);
    };
    actual.then(limpiar, limpiar);
    return actual;
  }

  /** Cuántas claves tienen trabajo en curso (para pruebas). */
  get enCurso(): number {
    return this.pendientes.size;
  }
}
