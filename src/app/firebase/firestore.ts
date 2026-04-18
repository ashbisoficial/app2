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
  fechaInicio: string;
  fechaFin?: string;
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
  fechaNacimiento?: string;
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
  tipo: string;
  fechaProgramada?: string;
  realizado?: boolean;
  fechaRealizado?: string;
  lugar?: string;
  costo?: number;
  notas?: string;
  ordenUrl?: string;
  resultadoUrl?: string;
  creadoPor: string;
};

export type Medicamento = {
  id?: string;
  nombre: string;
  mg: number;
  fechaInicio: string;
  fechaFin?: string;
  costo?: number;
  notas?: string;
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
  uidUsuario: string;
  fechaRegistro?: string;
};

@Injectable({ providedIn: 'root' })
export class FirestoreService {

  firestore: Firestore = inject(Firestore);

  getCollectionChanges<tipo>(path: string) {
    const itemCollection = collection(this.firestore, path);
    return collectionData(itemCollection) as Observable<tipo[]>;
  }

  async createDocument<tipo>(path: string, data: tipo, id: string = '') {
    let refDoc;
    if (id) {
      refDoc = doc(this.firestore, `${path}/${id}`);
    } else {
      const refCollection = collection(this.firestore, path);
      refDoc = doc(refCollection);
    }
    const dataDoc: any = data;
    dataDoc.id = refDoc.id;
    dataDoc.date = serverTimestamp();
    await setDoc(refDoc, dataDoc);
    return dataDoc.id;
  }

  createDocumentID(data: any, enlace: string, idDoc: string) {
    const document = doc(this.firestore, `${enlace}/${idDoc}`);
    return setDoc(document, data);
  }

  createIdDoc() { return uuidv4(); }
  createId(): string { return uuidv4(); }

  deleteDocumentID(enlace: string, idDoc: string) {
    const document = doc(this.firestore, `${enlace}/${idDoc}`);
    return deleteDoc(document);
  }

  getDocumentChanges<tipo>(path: string) {
    const document = doc(this.firestore, path);
    return docData(document) as Observable<tipo>;
  }

  async updateDocument(path: string, data: any) {
    const refDoc = doc(this.firestore, path);
    data.updateAt = serverTimestamp();
    return await updateDoc(refDoc, data);
  }

  async getDocument(path: string): Promise<any | null> {
    const refDoc = doc(this.firestore, path);
    const snap = await getDoc(refDoc);
    return snap.exists() ? snap.data() : null;
  }

  // ── Mascotas ──────────────────────────────────────────
  getUserPets(uid: string) {
    const r = collection(this.firestore, 'mascotas') as CollectionReference<Mascota>;
    const q = query(r, where('uidUsuario', '==', uid), orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Mascota[]>;
  }

  getPetById(id: string): Observable<Mascota | undefined> {
    const r = doc(this.firestore, 'mascotas', id);
    return docData(r, { idField: 'id' }) as Observable<Mascota | undefined>;
  }

  async updatePet(id: string, data: Partial<Mascota>): Promise<void> {
    const r = doc(this.firestore, 'mascotas', id);
    await updateDoc(r, data as any);
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
    await updateDoc(refDoc, { galeria: arrayUnion(...urls) } as any);
  }

  async removePhoto(petId: string, url: string): Promise<void> {
    const refDoc = doc(this.firestore, 'mascotas', petId);
    await updateDoc(refDoc, { galeria: arrayRemove(url) } as any);
  }

  async deletePhotoFromStorage(url: string): Promise<void> {
    const storage = getStorage();
    const r = ref(storage, url);
    await deleteObject(r);
  }

  // ── Citas ─────────────────────────────────────────────
  getCitasByMascota(petId: string): Observable<Cita[]> {
    const r = collection(this.firestore, `mascotas/${petId}/citas`);
    const q = query(r, orderBy('fechaInicio', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Cita[]>;
  }

  async addCita(petId: string, data: Cita) {
    return addDoc(collection(this.firestore, `mascotas/${petId}/citas`), data);
  }

  async updateCita(petId: string, citaId: string, data: Partial<Cita>) {
    return updateDoc(doc(this.firestore, `mascotas/${petId}/citas/${citaId}`), { ...data });
  }

  async deleteCita(petId: string, citaId: string) {
    return deleteDoc(doc(this.firestore, `mascotas/${petId}/citas/${citaId}`));
  }

  // ── Vacunas ───────────────────────────────────────────
  getVacunasByMascota(petId: string): Observable<Vacuna[]> {
    const r = collection(this.firestore, `mascotas/${petId}/vacunas`);
    const q = query(r, orderBy('fechaAplicacion', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Vacuna[]>;
  }

  async addVacuna(petId: string, data: Vacuna) {
    return addDoc(collection(this.firestore, `mascotas/${petId}/vacunas`), data);
  }

  async updateVacuna(petId: string, vacunaId: string, data: Partial<Vacuna>) {
    return updateDoc(doc(this.firestore, `mascotas/${petId}/vacunas/${vacunaId}`), { ...data });
  }

  async deleteVacuna(petId: string, vacunaId: string) {
    return deleteDoc(doc(this.firestore, `mascotas/${petId}/vacunas/${vacunaId}`));
  }

  // ── Exámenes ──────────────────────────────────────────
  getExamenesByMascota(petId: string): Observable<Examen[]> {
    const r = collection(this.firestore, `mascotas/${petId}/examenes`);
    const q = query(r, orderBy('fechaProgramada', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Examen[]>;
  }

  async addExamen(petId: string, data: Examen) {
    return addDoc(collection(this.firestore, `mascotas/${petId}/examenes`), data);
  }

  async updateExamen(petId: string, examenId: string, data: Partial<Examen>) {
    return updateDoc(doc(this.firestore, `mascotas/${petId}/examenes/${examenId}`), { ...data });
  }

  async deleteExamen(petId: string, examenId: string) {
    return deleteDoc(doc(this.firestore, `mascotas/${petId}/examenes/${examenId}`));
  }

  async uploadExamenFile(uid: string, petId: string, examenId: string, file: File, kind: 'orden' | 'resultado'): Promise<string> {
    const storage = getStorage();
    const path = `mascotas/${uid}/${petId}/examenes/${examenId}/${kind}-${Date.now()}-${file.name}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  }

  async removeExamenFileByUrl(url: string): Promise<void> {
    const storage = getStorage();
    await deleteObject(ref(storage, url));
  }

  // ── Medicamentos ──────────────────────────────────────
  getMedicamentosByMascota(petId: string): Observable<Medicamento[]> {
    const r = collection(this.firestore, `mascotas/${petId}/medicamentos`);
    const q = query(r, orderBy('fechaInicio', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Medicamento[]>;
  }

  async addMedicamento(petId: string, data: Medicamento) {
    return addDoc(collection(this.firestore, `mascotas/${petId}/medicamentos`), data);
  }

  async updateMedicamento(petId: string, medicamentoId: string, data: Partial<Medicamento>) {
    return updateDoc(doc(this.firestore, `mascotas/${petId}/medicamentos/${medicamentoId}`), { ...data });
  }

  async deleteMedicamento(petId: string, medicamentoId: string) {
    return deleteDoc(doc(this.firestore, `mascotas/${petId}/medicamentos/${medicamentoId}`));
  }

  // ── Veterinarias favoritas ────────────────────────────
  getVeterinariasFavoritasByUsuario(uid: string): Observable<VeterinariaFavorita[]> {
    const r = collection(this.firestore, `usuarios/${uid}/veterinariasFavoritas`);
    const q = query(r, orderBy('fechaRegistro', 'desc'));
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
    return updateDoc(doc(this.firestore, `usuarios/${uid}/veterinariasFavoritas/${vetId}`), { ...data });
  }

  async deleteVeterinariaFavorita(uid: string, vetId: string) {
    return deleteDoc(doc(this.firestore, `usuarios/${uid}/veterinariasFavoritas/${vetId}`));
  }

  // ── Lugares públicos (mapa) ───────────────────────────
  async getLugaresInfo(placeIds: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    if (!placeIds.length) return result;

    // Grupos de 10 en paralelo para no saturar Firestore
    const chunks: string[][] = [];
    for (let i = 0; i < placeIds.length; i += 10) {
      chunks.push(placeIds.slice(i, i + 10));
    }

    await Promise.all(
      chunks.map(chunk =>
        Promise.all(
          chunk.map(async id => {
            const snap = await getDoc(doc(this.firestore, `lugares/${id}`));
            if (snap.exists()) result[id] = snap.data();
          })
        )
      )
    );
    return result;
  }

  async saveLugarInfo(placeId: string, info: any): Promise<void> {
    const refDoc = doc(this.firestore, `lugares/${placeId}`);
    await setDoc(refDoc, { ...info, actualizadoEn: serverTimestamp() }, { merge: true });
  }
}