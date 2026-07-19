import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/weights';
let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  try {
    // Usamos TinyFaceDetector pois é muito mais leve e rápido no navegador
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log('Modelos do face-api.js carregados com sucesso');
  } catch (error) {
    console.error('Erro ao carregar modelos do face-api.js:', error);
    throw new Error('Falha ao carregar modelos de biometria facial.');
  }
}

export async function getFaceDescriptor(base64Image) {
  if (!base64Image) return null;
  await loadModels();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        
        if (!detection) {
          resolve(null);
        } else {
          // Retorna array padrão para salvar como JSON no BD
          resolve(Array.from(detection.descriptor));
        }
      } catch (err) {
        console.error('Erro ao processar biometria na imagem:', err);
        resolve(null);
      }
    };
    img.onerror = (err) => {
      console.error('Erro ao carregar objeto Image:', err);
      resolve(null);
    };
  });
}

export function compareFaces(descriptor1, descriptor2, threshold = 0.6) {
  if (!descriptor1 || !descriptor2) return { isMatch: false, distance: 1.0 };
  try {
    const d1 = typeof descriptor1 === 'string' ? JSON.parse(descriptor1) : descriptor1;
    const d2 = typeof descriptor2 === 'string' ? JSON.parse(descriptor2) : descriptor2;
    
    const arr1 = new Float32Array(d1);
    const arr2 = new Float32Array(d2);
    
    const distance = faceapi.euclideanDistance(arr1, arr2);
    return {
      isMatch: distance < threshold,
      distance
    };
  } catch (e) {
    console.error('Erro ao comparar biometria:', e);
    return { isMatch: false, distance: 1.0 };
  }
}
