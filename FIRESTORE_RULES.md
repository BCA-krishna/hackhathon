# Firestore Security Rules

Use these baseline rules to enforce authenticated access and per-user data boundaries.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Optional profile docs keyed by uid.
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Generic user-scoped data rule for salesData, alerts, forecasts, recommendations, uploads, etc.
    match /{collection}/{doc} {
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;

      allow read, update, delete: if request.auth != null
                                  && resource.data.userId == request.auth.uid;
    }
  }
}
```

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
