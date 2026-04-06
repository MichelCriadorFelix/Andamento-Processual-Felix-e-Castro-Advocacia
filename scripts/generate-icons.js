import fs from 'fs';
import { execSync } from 'child_process';

// We don't have sharp or canvas installed, but we can just use a base64 encoded transparent PNG for now, or just leave it as SVG.
// Actually, SVG is supported by Chrome for PWAs.
