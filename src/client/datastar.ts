// Import datastar engine and plugins
import { apply, load } from "@starfederation/datastar";
import * as plugins from "@starfederation/datastar/plugins";

// Load all official plugins
load(...Object.values(plugins));

// Apply datastar to the DOM
apply();
