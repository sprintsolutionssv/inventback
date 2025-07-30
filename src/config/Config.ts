import dotenv from 'dotenv';
import path from 'path';

type Env = 'development' | 'qa' | 'production';

interface IConfigValues {
  readonly NODE_ENV: Env;
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USER: string;
  readonly DB_PASSWORD: string;
  readonly DB_NAME: string;
  /** Opcional: URL construida si la necesitas */
  readonly DATABASE_URL: string;
  readonly JWT_SECRET: string;
  readonly PORT: number;
}

class Config implements IConfigValues {
  private static instance: Config;

  public readonly NODE_ENV: Env;
  public readonly DB_HOST: string;
  public readonly DB_PORT: number;
  public readonly DB_USER: string;
  public readonly DB_PASSWORD: string;
  public readonly DB_NAME: string;
  public readonly DATABASE_URL: string;
  public readonly JWT_SECRET: string;
  public readonly PORT: number;

  private constructor() {
    // 1) Determinar entorno y .env
    const env = (process.env.NODE_ENV as Env) || 'development';
    const envFile = path.resolve(process.cwd(), `.env.${env}`);
    const result = dotenv.config({ path: envFile });
    if (result.error) {
      throw new Error(`Error cargando ${path.basename(envFile)}: ${result.error.message}`);
    }

    // 2) Leer variables críticas
    const {
      NODE_ENV,
      DB_HOST,
      DB_PORT,
      DB_USER,
      DB_PASSWORD,
      DB_NAME,
      JWT_SECRET,
      PORT
    } = process.env;

    // 3) Validar presencia
    const missing: string[] = [];
    if (!NODE_ENV)    missing.push('NODE_ENV');
    if (!DB_HOST)     missing.push('DB_HOST');
    if (!DB_PORT)     missing.push('DB_PORT');
    if (!DB_USER)     missing.push('DB_USER');
    if (!DB_PASSWORD) missing.push('DB_PASSWORD');
    if (!DB_NAME)     missing.push('DB_NAME');
    if (!JWT_SECRET)  missing.push('JWT_SECRET');
    if (!PORT)        missing.push('PORT');

    if (missing.length) {
      throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
    }

    // 4) Asignar propiedades
    this.NODE_ENV   = NODE_ENV as Env;
    this.DB_HOST    = DB_HOST!;
    this.DB_PORT    = parseInt(DB_PORT!, 10);
    this.DB_USER    = DB_USER!;
    this.DB_PASSWORD= DB_PASSWORD!;
    this.DB_NAME    = DB_NAME!;
    this.JWT_SECRET = JWT_SECRET!;
    this.PORT       = parseInt(PORT!, 10);

    // 5) Construir URL si la necesitas
    this.DATABASE_URL =
      `postgresql://${this.DB_USER}:${encodeURIComponent(this.DB_PASSWORD)}` +
      `@${this.DB_HOST}:${this.DB_PORT}/${this.DB_NAME}`;

    // 6) Log de inicialización
    console.log(`\n[Config] Entorno:        ${this.NODE_ENV}`);
    console.log(`[Config] DB Host:        ${this.DB_HOST}`);
    console.log(`[Config] DB Port:        ${this.DB_PORT}`);
    console.log(`[Config] DB User:        ${this.DB_USER}`);
    console.log(`[Config] DB Name:        ${this.DB_NAME}`);
    console.log(`[Config] JWT_SECRET ok:  ${!!this.JWT_SECRET}`);
    console.log(`[Config] App Port:       ${this.PORT}\n`);
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

export default Config.getInstance();
