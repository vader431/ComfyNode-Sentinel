/**
 * Strict PEP-508 Torch Shield matcher.
 * Matches only core PyTorch/CUDA runtime packages (`torch`, `torchvision`, `torchaudio`, `xformers`)
 * at package-name boundaries so legitimate packages like `torchmetrics`, `torchsde`, or `open-clip-torch`
 * are NOT falsely flagged as PyTorch overwrite hazards.
 */

const PROTECTED_TORCH_PACKAGE_REGEX =
  /^(?:torch|torchvision|torchaudio|xformers)(?:$|\s*(?:[<>=!~;@\[].*))$/i;

export function isTorchProtectedRequirement(rawRequirement: string): boolean {
  const trimmed = rawRequirement.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
    return false;
  }
  return PROTECTED_TORCH_PACKAGE_REGEX.test(trimmed);
}

export function extractProtectedTorchPackages(requirements: string[]): string[] {
  return requirements.filter((req) => isTorchProtectedRequirement(req));
}

export function stripProtectedTorchPackages(requirements: string[]): string[] {
  return requirements.filter((req) => !isTorchProtectedRequirement(req));
}
