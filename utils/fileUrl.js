// Cloudinary returns a full https URL in req.file.path — keep it as-is.
// Older local-disk uploads stored a relative path — keep prefixing those with "/".
const normalizeFileUrl = (filePath) => {
  if (!filePath) return "";
  const clean = filePath.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(clean)) return clean;
  return "/" + (clean.startsWith("/") ? clean.slice(1) : clean);
};

module.exports = { normalizeFileUrl };
