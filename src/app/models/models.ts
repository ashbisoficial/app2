export namespace Models {

  // 🔐 AUTH
  export namespace Auth {

    export const PathUsers = 'usuarios'; // 👈 FALTABA ESTO

    export interface UserProfile {
      uid: string;
      nombre: string;
      apellido: string;
      email: string;
      telefono?: string;
      region?: string;
      direccion?: string;
      foto?: string;
      provider?: string;
    }
  }

  // 🐶 MASCOTAS
  export namespace Mascotas {
    export const PathMascotas = 'mascotas';

    export interface Mascota {
      id: string;
      uidUsuario: string;
      nombre: string;
      edad: number;
      sexo: string;
      fechaNacimiento: string;
      especie: string;
      color: string;
      raza: string;
      castrado: string;
      fechaRegistro: string;
    }
  }
}