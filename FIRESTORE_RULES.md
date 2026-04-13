# Firestore Security Rules

Use this temporary debug rule to quickly unblock permission errors while you validate the pipeline.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

After debugging is complete, replace this with stricter per-user rules before production.

## Storage Rules (Uploads)

Use per-user paths to isolate uploaded files and prevent cross-user reads/writes.

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Console Setup Checklist

1. Firebase Console -> Authentication -> Sign-in method -> enable Google provider.
2. OAuth consent screen in Google Cloud Console -> configure app details, authorized domains, test users (if needed).
3. Firebase Console -> Authentication -> Settings -> Authorized domains -> add your deployment domains.
4. Deploy security rules and validate with Firebase Emulator Suite before production.
