// Import datastar engine and plugins
import { load, apply } from "@starfederation/datastar";
import * as plugins from "@starfederation/datastar/plugins";

// Load all official plugins
load(...Object.values(plugins));

// Apply datastar to the DOM
apply();
