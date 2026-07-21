import * as faceapi from 'face-api.js';

const MODEL_URLS = [
  'https://cdn.jsdelivr.net/gh/cshao/face-api.js-models/weights',
  'https://justadudewhohacks.github.io/face-api.js/weights',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
];
let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  let lastErr = null;
  for (const url of MODEL_URLS) {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(url);
      await faceapi.nets.faceLandmark68Net.loadFromUri(url);
      await faceapi.nets.faceRecognitionNet.loadFromUri(url);
      modelsLoaded = true;
      console.log('Modelos do face-api.js carregados com sucesso de:', url);
      return;
    } catch (err) {
      console.warn(`Falha ao carregar modelos da URL ${url}:`, err);
      lastErr = err;
    }
  }
  console.error('Todas as tentativas de carregar modelos falharam:', lastErr);
  throw new Error('Falha ao carregar modelos de biometria facial.');
}

export async function getFaceDescriptor(base64Image) {
  if (!base64Image) return null;
  try {
    await loadModels();
  } catch (err) {
    console.error('Falha ao carregar modelos de biometria:', err);
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = async () => {
      try {
        // Tenta 1: detectSingleFace (416px, threshold 0.2)
        let detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        
        if (detection && detection.descriptor) {
          return resolve(Array.from(detection.descriptor));
        }

        // Tenta 2: detectAllFaces (320px, threshold 0.15)
        let allDetections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.15 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (allDetections && allDetections.length > 0 && allDetections[0].descriptor) {
          return resolve(Array.from(allDetections[0].descriptor));
        }

        // Tenta 3: detectAllFaces (224px, threshold 0.1)
        allDetections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.1 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (allDetections && allDetections.length > 0 && allDetections[0].descriptor) {
          return resolve(Array.from(allDetections[0].descriptor));
        }

        // Tenta 4: detectAllFaces (512px, threshold 0.1)
        allDetections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.1 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (allDetections && allDetections.length > 0 && allDetections[0].descriptor) {
          return resolve(Array.from(allDetections[0].descriptor));
        }

        console.warn('Nenhum rosto identificado mesmo com detecção adaptativa.');
        resolve(null);
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

export function compareFaces(descriptor1, descriptor2, threshold = 0.45) {
  if (!descriptor1 || !descriptor2) return { isMatch: false, distance: 1.0 };
  try {
    const d1 = typeof descriptor1 === 'string' ? JSON.parse(descriptor1) : descriptor1;
    const d2 = typeof descriptor2 === 'string' ? JSON.parse(descriptor2) : descriptor2;
    
    if (!Array.isArray(d1) || !Array.isArray(d2) || d1.length !== 128 || d2.length !== 128) {
      console.warn("Descritor facial inválido ou incompleto (deve ter 128 posições):", {
        d1Length: d1?.length,
        d2Length: d2?.length
      });
      return { isMatch: false, distance: 1.0 };
    }

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
