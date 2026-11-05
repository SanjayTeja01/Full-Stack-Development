/**
 * Grants the administrator role to an existing account. Run by a project owner with
 * Application Default Credentials (gcloud auth application-default login) or a service account:
 *
 *   GOOGLE_CLOUD_PROJECT=your-project npx tsx scripts/grant-admin.ts someone@example.com
 *
 * Admin rights can never be granted from the browser.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx scripts/grant-admin.ts <email>");
  process.exit(1);
}

initializeApp();
const auth = getAuth();
const db = getFirestore();

(async () => {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: "admin" });
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      userId: user.uid,
      displayName: user.displayName ?? email,
      role: "admin",
      location: { state: "Delhi", district: "—" },
      organizationName: "FarmConnect",
      verificationStatus: "unverified",
      accountStatus: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({ role: "admin", updatedAt: FieldValue.serverTimestamp() });
  }
  const logRef = db.collection("auditLogs").doc();
  await logRef.set({
    auditLogId: logRef.id,
    actorId: "cli",
    actorRole: "system",
    action: "admin.granted",
    targetType: "user",
    targetId: user.uid,
    reason: "Granted via grant-admin script",
    metadata: { email },
    timestamp: FieldValue.serverTimestamp(),
  });
  console.log(`Granted admin to ${email} (${user.uid}). They must sign out and back in.`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
