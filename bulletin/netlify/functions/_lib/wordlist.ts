/**
 * Words for generated passphrases.
 *
 * Chosen to be short, common, concrete, and unambiguous when read down a phone
 * line: no homophone pairs, no near-identical spellings, nothing that has to be
 * spelled out. Size is what carries the security — three words from this list
 * plus a four-digit number is roughly 40 bits, where three words from a
 * thirty-word list is barely stronger than a PIN.
 *
 * Stored as one string and split at load: it keeps the source compact and the
 * cost is a single split.
 */
const RAW = `
abbey acorn acre album alder alley almond amber anchor angle ankle anvil apple
apron arbor arcade arch arctic arena armor arrow ashen aspen asset atlas attic
autumn avenue awning axle azure bacon badge bagel bakery ballad balloon bamboo
banjo banner barge barley barrel basil basin basket batch beacon beetle bellow
bench beret berry bicycle birch biscuit bishop bison blanket blossom bobbin
bolster bonnet booth border bottle boulder bracket braid bramble branch brass
bread brick bridge bristle broom brook broth brush bucket buckle bugle bulb
bundle bunker burrow bushel butler button cabin cable cactus cadence camel
canal candle canoe canopy canvas canyon capsule caramel cargo carpet carrot
cascade castle cattle cauldron cedar cellar cement census chalk chapel charcoal
chart cheddar cherry chess chestnut chimney chisel chorus cider cinder circus
cistern citron clamp clarinet clatter cleaver clever clinic cloak clover cobalt
cobble cocoa collar column comet compass copper coral cork cornice corral
cottage cotton council courier cove cradle crane crater crayon creek crescent
crest cricket crimson crocus crowbar crumb crystal cupboard curator curtain
cushion cutlass cymbal cypress daffodil dagger dairy damson dandelion darling
dawn daybreak decoy delta denim depot derby desert diamond digit dinghy ditch
dockyard dogwood dollar domino donkey drawer drift drizzle drummer duchess
dugout dulcimer dunes dusk eagle earring easel ebony echo eclipse elbow elder
elephant elm ember emblem emerald emporium enamel engine envelope equator
escarpment estate ether fabric falcon fanfare fathom feather fedora fennel fern
ferry fiddle filament finch fjord flagon flannel flask flatbed flint florin
flotilla flourish flute foghorn foliage footpath forest forge fossil fountain
foxglove fragment freckle freighter fresco frost fulcrum funnel furnace gable
gadget gallery gallon gambit garden gargoyle garland garnet gateway gazebo
gecko gelatin gemstone geyser gherkin gimbal ginger giraffe glacier glade
glassware glimmer globe glossary gnome goblet gondola gopher gorge gosling
gourd granary granite grapefruit grapple gravel greenhouse griffin grommet
grotto guitar gullet gully gumbo gusset gutter gymnasium hacienda hackberry
hailstone halibut hallway hammock hamper handle hangar harbor hardware harmony
harpoon harvest hatchet hawthorn hazel headland hearth heather hedgehog helmet
hemlock heron herring hexagon hickory hillside hinge hollow holster homestead
honeycomb hoopla horizon hornet hostel humidor hurdle hutch hyacinth iceberg
igloo inkwell inlet insect ironwood island isthmus ivory jackal jamboree
jasmine javelin jelly jetty jigsaw jonquil journal juniper kayak kelp kennel
kernel kestrel kettle keystone kimono kindling kingfisher kiosk kitchen kite
knapsack knoll knuckle lacquer ladder lagoon lamppost lancet landmark lantern
lapel larder lattice laurel lavender ledger legume lemon lentil leopard levee
lever lichen lifeboat lighthouse lilac limestone linden linen lintel lobster
locket locomotive lodge lookout lotus lozenge lumber lupine lyric macaw
magnolia mahogany mailbox mallet mandolin mango mantle maple marble margin
marigold marina marlin marmalade marsh marvel mascot mason mattress meadow
medallion melody meridian mesa mica midway milestone millet mimosa mineral
minnow mint mirror mistletoe mitten moat mohair molasses monarch monsoon
moorland mortar mosaic mossy motto mountain mulberry mullet muffin muslin
mustard mutton nautical nectar needle nestle nettle nickel nightfall nomad
notch nougat nozzle nutmeg oakwood oasis oatmeal obelisk observatory octagon
octopus omelet onyx opal orchard orchid oregano organza osprey ottoman outcrop
outpost oval overcoat owlet oxbow oyster paddle pagoda palette palisade pamphlet
pancake panorama pantry papaya paprika papyrus parapet parcel parchment parlor
parsnip parsley partridge pasture pathway patio pavilion peach peacock pebble
pecan pedal pelican pendant peninsula peony pepper pergola periwinkle petal
pewter pheasant piano piccolo picket pigment pilgrim pillar pinecone pipeline
pistachio pitcher plateau platform plover plumage plywood pocket podium polar
pollen pomelo poncho pontoon poplar poppy porcelain porch portico postcard
pottery prairie pretzel primrose prism promenade pudding puffin pumpkin purple
pyramid quarry quartz quilt quiver radish rafter railcar rainbow rampart ranch
rapids raven ravine rectory redwood reef regatta relay reptile reservoir
rhubarb ribbon ridgeline rigging rivulet roadside robin rockery rooster rosemary
rotunda rowboat rudder runway rustic saddle saffron sagebrush sailboat salmon
saltbox samphire sandal sandbar sapling sapphire sardine sassafras satchel
saucer sawmill scaffold scallop scarab schooner scissors scooter scrapbook
sculpture seabird seagull seashell seaweed sequoia settee shamrock shanty
shelter sherbet shingle shipyard shoreline shovel shrubbery shutter sickle
sidecar silica silo silver skillet skylark skyline slalom sleigh slipper
snapdragon snorkel snowdrift socket sofa sojourn solstice sonata songbird
sorbet sorghum spaniel sparrow spatula spearmint spigot spindle spinnaker
spiral splendor spool sprocket spruce spyglass squash stable stadium stagecoach
stairwell stallion stanza starfish stencil stirrup stockade stonework stopwatch
storeroom stovepipe strawberry stream stucco studio sturgeon sugarcane sundial
sunflower surfboard swallow swamp sweater sycamore syrup tabby tackle taffeta
talcum tallow tambourine tangelo tankard tapestry tarragon tartan tavern
teakettle teapot telescope tenant tendril terrace terrier textile thicket
thimble thistle thorn threshold thunder thyme tidepool timber tinder toboggan
toffee tollgate topaz topsoil torchlight tortoise totem toucan towpath trailer
trawler treadle trellis triangle tributary trinket trolley trombone trophy
trout trowel trumpet tundra tunnel turbine turnip turnstile turquoise turtle
twilight typhoon ukulele umbrella upland urchin utensil valley vanilla vantage
varnish vellum velvet veranda vessel viaduct village vinegar vineyard violet
viper vista volcano voyage waffle wagon wallet walnut warbler wardrobe warehouse
watercress waterfall wattle weathervane weaver webbing wedge whalebone wharf
wheelbarrow whetstone whisker whistle wickerwork wigwam wildflower willow
windmill windowpane winery wintergreen wisteria wolfhound wombat woodland
woodpecker woolen workbench wreath wrench yardstick yarrow yellow yeoman
yesterday yew yodel yogurt yonder zeppelin zinnia zither zodiac zucchini
`;

export const WORDS: readonly string[] = [...new Set(RAW.split(/\s+/).filter(Boolean))];
