import { mountGallery } from '@neon-cards/ui/gallery'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from ui-gallery.html')
mountGallery(root)
