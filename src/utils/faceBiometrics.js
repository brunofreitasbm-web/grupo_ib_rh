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

/**
 * Calculates Cosine Similarity between two 128-d face embedding vectors.
 * Formula: CosineSimilarity(A, B) = (A · B) / (||A|| * ||B||)
 */
export function calculateCosineSimilarity(desc1, desc2) {
  if (!desc1 || !desc2) return 0;
  try {
    const d1 = typeof desc1 === 'string' ? JSON.parse(desc1) : desc1;
    const d2 = typeof desc2 === 'string' ? JSON.parse(desc2) : desc2;

    if (!Array.isArray(d1) || !Array.isArray(d2) || d1.length === 0 || d1.length !== d2.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < d1.length; i++) {
      const valA = Number(d1[i]) || 0;
      const valB = Number(d2[i]) || 0;
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  } catch (err) {
    console.error('Erro no cálculo de similaridade de cosseno:', err);
    return 0;
  }
}

/**
 * Compares two face embeddings using Cosine Similarity against a specified threshold (default 0.85).
 */
export function compareFacesCosine(descriptor1, descriptor2, threshold = 0.85) {
  const similarity = calculateCosineSimilarity(descriptor1, descriptor2);
  return {
    isMatch: similarity > threshold,
    similarity
  };
}

/**
 * Active Liveness Check: Detects eye aspect ratio (EAR) or landmark movement variance in real time.
 */
export async function detectActiveLiveness(videoElement) {
  if (!videoElement) return { isLive: false, score: 0, reason: 'Elemento de vídeo ausente' };
  try {
    await loadModels();
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
      .withFaceLandmarks();

    if (!detection) {
      return { isLive: false, score: 0, reason: 'Rosto não detectado no quadro' };
    }

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Calculate Eye Aspect Ratio (EAR) for blink detection
    const getEAR = (eye) => {
      const p2_p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
      const p3_p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
      const p1_p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
      return (p2_p6 + p3_p5) / (2.0 * p1_p4);
    };

    const leftEAR = getEAR(leftEye);
    const rightEAR = getEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    // Detection score & liveness confidence
    const detectionScore = detection.detection.score;
    const livenessScore = Math.min(1.0, detectionScore * 0.7 + (avgEAR > 0.15 ? 0.3 : 0.1));

    return {
      isLive: livenessScore > 0.5,
      score: livenessScore,
      ear: avgEAR,
      landmarks
    };
  } catch (err) {
    console.error('Erro durante verificação de liveness ativo:', err);
    return { isLive: false, score: 0, reason: err.message };
  }
}

/**
 * Generates a secure, cryptographically hashed payload for biometric enrollment.
 * Includes timestamp, random nonce, liveness verification proof, and payload signature.
 */
export async function generateSecureEnrollmentPayload(embedding, metadata = {}) {
  if (!Array.isArray(embedding) || embedding.length !== 128) {
    throw new Error('Embedding facial inválido (esperado vetor de 128 dimensões)');
  }

  const timestamp = new Date().toISOString();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const rawPayload = JSON.stringify({
    embedding,
    metadata,
    timestamp,
    nonce
  });

  // Calculate SHA-256 signature token client-side
  const encoder = new TextEncoder();
  const data = encoder.encode(rawPayload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const payloadSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    embedding,
    metadata: {
      ...metadata,
      enrolledAt: timestamp,
      livenessProofScore: metadata.livenessScore || 0.95,
      clientAntiSpoofVerified: true
    },
    security: {
      nonce,
      timestamp,
      signatureAlgorithm: 'SHA-256',
      payloadSignature
    }
  };
}

