import { addDoc, collection, onSnapshot, query, serverTimestamp, where, getDocs, deleteDoc } from 'firebase/firestore';
// Delete all feedback analysis history for a user
export async function deleteAllFeedbackHistory(userId) {
  if (!userId) return;
  const q = query(collection(db, 'feedbackAnalysisHistory'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const batchDeletes = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
  await Promise.all(batchDeletes);
}
import { db } from './firebase';

function toDate(value) {
  if (!value) return new Date(0);
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

export async function saveFeedbackAnalysis({ userId, reviews, analysis, aiInsights }) {
  if (!userId) {
    throw new Error('Please sign in to save feedback analysis history.');
  }

  await addDoc(collection(db, 'feedbackAnalysisHistory'), {
    userId,
    reviews,
    reviewCount: Array.isArray(reviews) ? reviews.length : 0,
    summary: analysis.summary,
    report: analysis.report,
    aiInsights: aiInsights || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function subscribeFeedbackHistory(userId, onData, onError) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, 'feedbackAnalysisHistory'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());

      onData(rows);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}
