// The schema is a pure module: frontend and server use the same defaults/validation.
export {
  SOFRA_DEFAULTS,
  SOFRA_TEXT_FIELDS,
  normalizeSofraConfig,
  sofraCopy,
} from '../../../backend/src/lib/sofra-config';
export type { SofraConfig, SofraCopy, SofraTextField } from '../../../backend/src/lib/sofra-config';
