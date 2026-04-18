import { inject, Injectable } from '@angular/core';
import { Firestore, collection, collectionData, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, docData, addDoc } from '@angular/fire/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { query, where, orderBy, CollectionReference } from '@angular/fire/firestore';
import { arrayUnion, arrayRemove } from 'firebase/firestore';

export type Cita = {
  id?: string;
  titulo: string;
  fechaInicio: string; // ISO
  fechaFin?: string;   // ISO
  lugar?: string;
  notas?: string;
  creadoPor: string;
};

export interface Mascota {
  id: string;
  nombre: string;
  especie: string;
  raza: string;
  sexo: string;
  color?: string;
  castrado?: 'Sí' | 'No' | 'Si' | 'No';
  edad?: number;
  fechaNacimiento?: string; // o Timestamp si lo guardas así
  fechaRegistro?: string;
  date?: any;
  uidUsuario: string;
  fotoUrl?: string;
  galeria?: string[];
  numeroChip?: string;
}

export type Vacuna = {
  id?: string;
  tipo: string;                 
  fechaAplicacion: string;      
  notas?: string;
  creadoPor: string;
  proximaFecha?: string;        
};

export type Examen = {
  id?: string;
  tipo: string;                 // p.ej.: "Perfil bioquímico", "Radiografía", etc.
  fechaProgramada?: string;     // ISO
  realizado?: boolean;          // check de estado
  fechaRealizado?: string;      // ISO (si realizado)
  lugar?: string;
  costo?: number;
  notas?: string;

  // URLs de archivos en Storage
  ordenUrl?: string;            // imagen/archivo de orden médica
  resultadoUrl?: string;        // imagen/archivo de resultados

  creadoPor: string;
};

export type Medicamento = {
  id?: string;
  nombre: string;
  mg: number;                 // dosis en mg
  fechaInicio: string;        // ISO
  fechaFin?: string;          // ISO (opcional)
  costo?: number;             // CLP (opcional)
  notas?: string;             // nota de comportamiento (opcional)
  creadoPor: string;
};

export type VeterinariaFavorita = {
  id?: string;
  placeId: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  rating?: number;
  tipos?: string[];
  uidUsuario: string;     // para trazabilidad
  fechaRegistro?: string; // opcional ISO
};


@Injectable({
  providedIn: 'root'
})
export class FirestoreService {

  firestore: Firestore = inject(Firestore)

  getCollectionChanges<tipo>(path:string){
    const itemCollection = collection(this.firestore, path);
    return collectionData(itemCollection) as Observable<tipo[]>;
  }

  //Forma 1, El enlace y el id vienen listos
  async createDocument<tipo>(path:string, data:tipo, id:string = ''){
    let refDoc;
    if (id) {
        refDoc = doc(this.firestore, `${path}/${id}`)
    }
    else {
        const refCollection = collection(this.firestore, path)
        refDoc = doc(refCollection);
    }
    const dataDoc: any = data;
    dataDoc.id = refDoc.id;
    dataDoc.date = serverTimestamp()
    await setDoc(refDoc, dataDoc);
    return dataDoc.id;
  }

  //Forma 2, concateno el enlace con el id del documento
  createDocumentID(data:any, enlace:string, idDoc: string){
    const document = doc(this.firestore, `${enlace}/${idDoc}`)
    return setDoc(document, data)
  }

  createIdDoc(){
    return uuidv4()
  }

  deleteDocumentID(enlace: string, idDoc: string){
    const document = doc(this.firestore, `${enlace}/${idDoc}`);
    return deleteDoc(document)
  }

  createId(): string {
    return uuidv4();
  }

  getDocumentChanges<tipo>(path: string){
    const document = doc(this.firestore, path);
    return docData(document) as Observable<tipo>
  }

  async updateDocument(path: string, data: any){
    const refDoc = doc(this.firestore, path)
    data.updateAt = serverTimestamp()
    return await updateDoc(refDoc, data)
  }

  getUserPets(uid: string) {
    const ref = collection(this.firestore, 'mascotas') as CollectionReference<Mascota>;
    const q = query(ref, where('uidUsuario', '==', uid), orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Mascota[]>;
  }

    getPetById(id: string): Observable<Mascota | undefined> {
    const ref = doc(this.firestore, 'mascotas', id);
    return docData(ref, { idField: 'id' }) as Observable<Mascota | undefined>;
  }

  async updatePet(id: string, data: Partial<Mascota>): Promise<void> {
    const ref = doc(this.firestore, 'mascotas', id);
    await updateDoc(ref, data as any);
  }

  async uploadPetPhotos(uid: string, petId: string, files: File[]): Promise<string[]> {
    const storage = getStorage();
    const urls: string[] = [];
    for (const f of files) {
      const path = `mascotas/${uid}/${petId}/galeria/${Date.now()}-${f.name}`;
      const r = ref(storage, path);
      await uploadBytes(r, f);
      urls.push(await getDownloadURL(r));
    }
    return urls;
  }

  async appendPhotos(petId: string, urls: string[]): Promise<void> {
    const refDoc = doc(this.firestore, 'mascotas', petId);
    // una sola operación con arrayUnion de todas las urls
    await updateDoc(refDoc, { galeria: arrayUnion(...urls) } as any);
  }

  async removePhoto(petId: string, url: string): Promise<void> {
    const refDoc = doc(this.firestore, 'mascotas', petId);
    await updateDoc(refDoc, { galeria: arrayRemove(url) } as any);
  }

  async deletePhotoFromStorage(url: string): Promise<void> {
    const storage = getStorage();
    // ref acepta URL https/gs => no necesitas refFromURL
    const r = ref(storage, url);
    await deleteObject(r);
  }  

  getCitasByMascota(petId: string): Observable<Cita[]> {
    const ref = collection(this.firestore, `mascotas/${petId}/citas`);
    const q = query(ref, orderBy('fechaInicio', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Cita[]>;
  }

  // Crear cita
  async addCita(petId: string, data: Cita) {
    const ref = collection(this.firestore, `mascotas/${petId}/citas`);
    return addDoc(ref, data);
  }

  // Actualizar cita
  async updateCita(petId: string, citaId: string, data: Partial<Cita>) {
    const ref = doc(this.firestore, `mascotas/${petId}/citas/${citaId}`);
    return updateDoc(ref, { ...data });
  }

  // Borrar cita
  async deleteCita(petId: string, citaId: string) {
    const ref = doc(this.firestore, `mascotas/${petId}/citas/${citaId}`);
    return deleteDoc(ref);
  }  

  //Métodos para vacunas
  getVacunasByMascota(petId: string): Observable<Vacuna[]> {
    const ref = collection(this.firestore, `mascotas/${petId}/vacunas`);
    const q = query(ref, orderBy('fechaAplicacion', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Vacuna[]>;
  }

  // Crear vacuna
  async addVacuna(petId: string, data: Vacuna) {
    const ref = collection(this.firestore, `mascotas/${petId}/vacunas`);
    return addDoc(ref, data);
  }

  // Actualizar vacuna
  async updateVacuna(petId: string, vacunaId: string, data: Partial<Vacuna>) {
    const ref = doc(this.firestore, `mascotas/${petId}/vacunas/${vacunaId}`);
    return updateDoc(ref, { ...data });
  }

  // Borrar vacuna
  async deleteVacuna(petId: string, vacunaId: string) {
    const ref = doc(this.firestore, `mascotas/${petId}/vacunas/${vacunaId}`);
    return deleteDoc(ref);
  }    

  // ➕ Exámenes (subcolección)
  getExamenesByMascota(petId: string): Observable<Examen[]> {
    const ref = collection(this.firestore, `mascotas/${petId}/examenes`);
    const q = query(ref, orderBy('fechaProgramada', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Examen[]>;
  }

  async addExamen(petId: string, data: Examen) {
    const ref = collection(this.firestore, `mascotas/${petId}/examenes`);
    return addDoc(ref, data);
  }

  async updateExamen(petId: string, examenId: string, data: Partial<Examen>) {
    const ref = doc(this.firestore, `mascotas/${petId}/examenes/${examenId}`);
    return updateDoc(ref, { ...data });
  }

  async deleteExamen(petId: string, examenId: string) {
    const ref = doc(this.firestore, `mascotas/${petId}/examenes/${examenId}`);
    return deleteDoc(ref);
  }

  // ➕ Uploads (orden / resultado)
  async uploadExamenFile(
    uid: string,
    petId: string,
    examenId: string,
    file: File,
    kind: 'orden' | 'resultado'
  ): Promise<string> {
    const storage = getStorage();
    const path = `mascotas/${uid}/${petId}/examenes/${examenId}/${kind}-${Date.now()}-${file.name}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  }

  async removeExamenFileByUrl(url: string): Promise<void> {
    const storage = getStorage();
    const r = ref(storage, url);
    await deleteObject(r);
  } 
  
  // 👉 2. Query por mascota
  getMedicamentosByMascota(petId: string): Observable<Medicamento[]> {
    const ref = collection(this.firestore, `mascotas/${petId}/medicamentos`);
    const q = query(ref, orderBy('fechaInicio', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Medicamento[]>;
  }

  // 👉 3. Crear
  async addMedicamento(petId: string, data: Medicamento) {
    const ref = collection(this.firestore, `mascotas/${petId}/medicamentos`);
    return addDoc(ref, data);
  }

  // 👉 4. Actualizar
  async updateMedicamento(petId: string, medicamentoId: string, data: Partial<Medicamento>) {
    const ref = doc(this.firestore, `mascotas/${petId}/medicamentos/${medicamentoId}`);
    return updateDoc(ref, { ...data });
  }

  // 👉 5. Borrar
  async deleteMedicamento(petId: string, medicamentoId: string) {
    const ref = doc(this.firestore, `mascotas/${petId}/medicamentos/${medicamentoId}`);
    return deleteDoc(ref);
  }  

  // 🐾 Veterinarias favoritas (por usuario)
  getVeterinariasFavoritasByUsuario(uid: string): Observable<VeterinariaFavorita[]> {
    const ref = collection(this.firestore, `usuarios/${uid}/veterinariasFavoritas`);
    const q = query(ref, orderBy('fechaRegistro', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<VeterinariaFavorita[]>;
  }

  async addVeterinariaFavorita(uid: string, data: Omit<VeterinariaFavorita, 'id' | 'uidUsuario' | 'fechaRegistro'>) {
    const refCol = collection(this.firestore, `usuarios/${uid}/veterinariasFavoritas`);
    const payload: VeterinariaFavorita = {
      ...data,
      uidUsuario: uid,
      fechaRegistro: new Date().toISOString(),
    };
    return addDoc(refCol, payload);
  }

  async updateVeterinariaFavorita(uid: string, vetId: string, data: Partial<VeterinariaFavorita>) {
    const refDoc = doc(this.firestore, `usuarios/${uid}/veterinariasFavoritas/${vetId}`);
    return updateDoc(refDoc, { ...data });
  }

  async deleteVeterinariaFavorita(uid: string, vetId: string) {
    const refDoc = doc(this.firestore, `usuarios/${uid}/veterinariasFavoritas/${vetId}`);
    return deleteDoc(refDoc);
  }

  async getDocument(path: string): Promise<any | null> {
    const ref = doc(this.firestore, path);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return snap.data();
    } else {
      return null;
    }
  }

  // 📍 Info pública de lugares (veterinarias / tiendas OSM)
async getLugarInfo(placeId: string): Promise<any | null> {
  const refDoc = doc(this.firestore, `lugares/${placeId}`);
  const snap = await getDoc(refDoc);
  return snap.exists() ? snap.data() : null;
}

async saveLugarInfo(placeId: string, info: any): Promise<void> {
  const refDoc = doc(this.firestore, `lugares/${placeId}`);
  await setDoc(refDoc, { ...info, actualizadoEn: serverTimestamp() }, { merge: true });
}
}
