export interface IConnectionStrategy {
  /** Nombre único de la estrategia */
  name: string;

  /** Abre (o reutiliza) la conexión */
  connect(): Promise<any>;

  /** Cierra la conexión si existe */
  disconnect(): Promise<void>;

  /** Devuelve la instancia activa de conexión */
  getConnection(): any;
}
