import { IConnectionStrategy } from './IConnectionStrategy';

class ConnectionManager {
  private static instance: ConnectionManager;
  private strategies = new Map<string, IConnectionStrategy>();
  private connections = new Map<string, any>();

  private constructor() {}

  /** Devuelve la instancia única del gestor */
  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Registra una nueva estrategia.
   * Lanza error si el nombre ya existe.
   */
  public registerStrategy(name: string, strategy: IConnectionStrategy): void {
    if (this.strategies.has(name)) {
      throw new Error(`Strategy '${name}' already registered.`);
    }
    this.strategies.set(name, strategy);
  }

  /**
   * Devuelve la conexión para la estrategia indicada.
   * Si no existe, la crea.
   */
  public async getConnection(name: string): Promise<any> {
    if (this.connections.has(name)) {
      return this.connections.get(name);
    }
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`No strategy registered for '${name}'.`);
    }
    const conn = await strategy.connect();
    this.connections.set(name, conn);
    return conn;
  }

  /** Cierra todas las conexiones activas */
  public async closeAllConnections(): Promise<void> {
    for (const [name, strategy] of this.strategies) {
      if (this.connections.has(name)) {
        await strategy.disconnect();
        this.connections.delete(name);
      }
    }
  }
}

export default ConnectionManager.getInstance();
