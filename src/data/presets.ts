/**
 * Curated preset symbol library.
 *
 * Every entry here was rendered through milsymbol the way the plugin renders
 * it — `ms.setStandard('APP6')` plus the "14" -> "13" rewrite from
 * `renderingSidc()` — and only ships if the SIDC is 30 digits, `isValid()` is
 * true, `hasIconGeometry()` reports real icon geometry beyond the bare frame,
 * and the "undefined icon" question-mark path is absent. `test/presets.test.ts`
 * re-runs those four checks in CI, so a milsymbol upgrade that drops an icon
 * fails the build rather than shipping an empty frame to a user.
 *
 * The generator that produced the table lives in
 * `research/scratch/20-presets-build.mjs`; the first 33 rows come from
 * `research/05-amplifiers-and-layout.md` section 6, converted from version 13
 * to version 14 (APP-6E).
 */

export interface Preset {
  /** 30-digit APP-6E SIDC */
  sidc: string
  /** short label shown in the UI and used for the Figma layer name */
  label: string
  /** category heading */
  category: string
  /** optional search keywords beyond the label */
  keywords?: string
}

export const PRESETS: Preset[] = [
  /* Land manoeuvre */
  { sidc: '140310001412110000000000000000', label: 'Infantry platoon', category: 'Land manoeuvre', keywords: 'rifle foot' },
  { sidc: '140310001512110000000000000000', label: 'Infantry company', category: 'Land manoeuvre', keywords: 'rifle foot' },
  { sidc: '140310001612110000000000000000', label: 'Infantry battalion', category: 'Land manoeuvre', keywords: 'rifle foot' },
  { sidc: '140310002112110000000000000000', label: 'Infantry division', category: 'Land manoeuvre' },
  { sidc: '140310021612110000000000000000', label: 'Infantry battalion HQ', category: 'Land manoeuvre', keywords: 'headquarters command post' },
  { sidc: '140310001512110200000000000000', label: 'Mechanized infantry company', category: 'Land manoeuvre', keywords: 'tracked armoured' },
  { sidc: '140310001812110200000000000000', label: 'Mechanized infantry brigade', category: 'Land manoeuvre', keywords: 'tracked armoured' },
  { sidc: '140310001512110400000000000000', label: 'Motorized infantry company', category: 'Land manoeuvre', keywords: 'truck wheeled' },
  { sidc: '140310001512110500000000000000', label: 'Infantry fighting vehicle company', category: 'Land manoeuvre', keywords: 'IFV' },
  { sidc: '140310001612050000000000000000', label: 'Armoured battalion', category: 'Land manoeuvre', keywords: 'tank mechanized' },
  { sidc: '140310041612050000000000000000', label: 'Armoured task force', category: 'Land manoeuvre', keywords: 'tank TF' },
  { sidc: '140310001512050100000000000000', label: 'Armoured cavalry troop', category: 'Land manoeuvre', keywords: 'recce scout' },
  { sidc: '140310001412130000000000000000', label: 'Reconnaissance platoon', category: 'Land manoeuvre', keywords: 'recce cavalry scout' },
  { sidc: '140310001612100000000000000000', label: 'Combined arms battalion', category: 'Land manoeuvre' },
  { sidc: '140310001512040000000000000000', label: 'Antitank company', category: 'Land manoeuvre', keywords: 'antiarmor' },
  { sidc: '140310001512010000000000000000', label: 'Air assault company', category: 'Land manoeuvre', keywords: 'airmobile' },
  { sidc: '140310001612060000000000000000', label: 'Army aviation squadron', category: 'Land manoeuvre', keywords: 'helicopter rotary' },
  { sidc: '140310001512170000000000000000', label: 'Special forces company', category: 'Land manoeuvre', keywords: 'SF' },
  { sidc: '140310001512200000000000000000', label: 'Ranger company', category: 'Land manoeuvre' },
  { sidc: '140310001112150000000000000000', label: 'Sniper team', category: 'Land manoeuvre', keywords: 'marksman' },
  { sidc: '140610001512110000000000000000', label: 'Infantry company (hostile)', category: 'Land manoeuvre', keywords: 'enemy red' },
  { sidc: '140610001612050000000000000000', label: 'Armoured battalion (hostile)', category: 'Land manoeuvre', keywords: 'tank enemy' },
  { sidc: '140110001512110000000000000000', label: 'Infantry company (unknown)', category: 'Land manoeuvre', keywords: 'unidentified' },
  { sidc: '140510001412130000000000000000', label: 'Reconnaissance platoon (suspect)', category: 'Land manoeuvre', keywords: 'amber' },
  { sidc: '140210001512110000000000000000', label: 'Infantry company (assumed friend)', category: 'Land manoeuvre' },

  /* Combat support */
  { sidc: '140310001613030000000000000000', label: 'Field artillery battalion', category: 'Combat support', keywords: 'guns fires' },
  { sidc: '140310001413030000000000000000', label: 'Field artillery platoon', category: 'Combat support', keywords: 'guns fires' },
  { sidc: '140310001413080000000000000000', label: 'Mortar platoon', category: 'Combat support', keywords: 'fires' },
  { sidc: '140310001513010000000000000000', label: 'Air defence battery', category: 'Combat support', keywords: 'AD SHORAD' },
  { sidc: '140310001513010200000000000000', label: 'Air defence missile battery', category: 'Combat support', keywords: 'SAM' },
  { sidc: '140310001613070000000000000000', label: 'Missile battalion', category: 'Combat support', keywords: 'rocket' },
  { sidc: '140310001113040000000000000000', label: 'Artillery observer team', category: 'Combat support', keywords: 'FO forward observer' },
  { sidc: '140310001514070000000000000000', label: 'Engineer company', category: 'Combat support', keywords: 'sapper' },
  { sidc: '140310001814070000000000000000', label: 'Engineer brigade', category: 'Combat support', keywords: 'sapper' },
  { sidc: '140310001514010000000000000000', label: 'CBRN defence company', category: 'Combat support', keywords: 'chemical nuclear' },
  { sidc: '140310001414080000000000000000', label: 'EOD platoon', category: 'Combat support', keywords: 'explosive ordnance disposal' },
  { sidc: '140310001514120000000000000000', label: 'Military police company', category: 'Combat support', keywords: 'MP' },
  { sidc: '140310001514170000000000000000', label: 'Security company', category: 'Combat support', keywords: 'guard' },
  { sidc: '140310001511100000000000000000', label: 'Signal company', category: 'Combat support', keywords: 'communications' },
  { sidc: '140310021611000000000000000000', label: 'Command and control battalion HQ', category: 'Combat support', keywords: 'C2 headquarters' },
  { sidc: '140310001511020000000000000000', label: 'Civil affairs company', category: 'Combat support', keywords: 'CIMIC' },
  { sidc: '140310001615100000000000000000', label: 'Military intelligence battalion', category: 'Combat support', keywords: 'MI' },
  { sidc: '140310001515050000000000000000', label: 'Electronic warfare company', category: 'Combat support', keywords: 'EW' },
  { sidc: '140310001415050400000000000000', label: 'Electronic warfare jamming platoon', category: 'Combat support', keywords: 'EW jammer' },
  { sidc: '140310001115020000000000000000', label: 'Counterintelligence team', category: 'Combat support', keywords: 'CI' },
  { sidc: '140310001412160000000000000000', label: 'Surveillance platoon', category: 'Combat support', keywords: 'ISR' },
  { sidc: '140310001414180000000000000000', label: 'Search and rescue platoon', category: 'Combat support', keywords: 'SAR' },

  /* Sustainment */
  { sidc: '140310001516130000000000000000', label: 'Medical company', category: 'Sustainment', keywords: 'medic health' },
  { sidc: '140310001416140000000000000000', label: 'Medical treatment facility platoon', category: 'Sustainment', keywords: 'hospital role 1' },
  { sidc: '140310001516020000000000000000', label: 'Supply company, all classes', category: 'Sustainment', keywords: 'logistics' },
  { sidc: '140410001516020000000000000000', label: 'Supply company (neutral)', category: 'Sustainment', keywords: 'logistics' },
  { sidc: '140310001516040000000000000000', label: 'Ammunition company', category: 'Sustainment', keywords: 'ammo class V' },
  { sidc: '140310001516250000000000000000', label: 'Petroleum company', category: 'Sustainment', keywords: 'POL fuel class III' },
  { sidc: '140310001516110000000000000000', label: 'Maintenance company', category: 'Sustainment', keywords: 'repair' },
  { sidc: '140310001616360000000000000000', label: 'Transportation battalion', category: 'Sustainment', keywords: 'movement' },
  { sidc: '140310001616060000000000000000', label: 'Combat service support battalion', category: 'Sustainment', keywords: 'CSS' },
  { sidc: '140310001416480000000000000000', label: 'Water purification platoon', category: 'Sustainment', keywords: 'water' },
  { sidc: '140310001416160000000000000000', label: 'Mortuary affairs platoon', category: 'Sustainment', keywords: 'graves' },
  { sidc: '140310001116310000000000000000', label: 'Religious support team', category: 'Sustainment', keywords: 'chaplain' },

  /* Air */
  { sidc: '140301000011010400000000000000', label: 'Fighter', category: 'Air', keywords: 'fast jet' },
  { sidc: '140601000011010400000000000000', label: 'Fighter (hostile)', category: 'Air', keywords: 'fast jet enemy' },
  { sidc: '140301000011010200000000000000', label: 'Attack aircraft', category: 'Air', keywords: 'strike CAS' },
  { sidc: '140301000011010300000000000000', label: 'Bomber', category: 'Air' },
  { sidc: '140301000011010700000000000000', label: 'Cargo aircraft', category: 'Air', keywords: 'transport airlift' },
  { sidc: '140301000011010900000000000000', label: 'Tanker aircraft', category: 'Air', keywords: 'air-to-air refuelling' },
  { sidc: '140301000011011600000000000000', label: 'Airborne early warning', category: 'Air', keywords: 'AEW AWACS' },
  { sidc: '140301000011011100000000000000', label: 'Reconnaissance aircraft', category: 'Air', keywords: 'ISR' },
  { sidc: '140301000011010800000000000000', label: 'Electronic combat aircraft', category: 'Air', keywords: 'jammer EC' },
  { sidc: '140301000011010100000000000000', label: 'MEDEVAC aircraft', category: 'Air', keywords: 'casevac' },
  { sidc: '140301000011012000000000000000', label: 'Combat search and rescue aircraft', category: 'Air', keywords: 'CSAR' },
  { sidc: '140301000011020000000000000000', label: 'Rotary wing aircraft', category: 'Air', keywords: 'helicopter' },
  { sidc: '140301000011030000000000000000', label: 'Unmanned aerial vehicle', category: 'Air', keywords: 'UAV UAS drone' },
  { sidc: '140601000011030000000000000000', label: 'Unmanned aerial vehicle (hostile)', category: 'Air', keywords: 'UAV drone enemy' },
  { sidc: '140301000011040000000000000000', label: 'Vertical-takeoff UAV', category: 'Air', keywords: 'VT-UAV drone' },
  { sidc: '140301000011050000000000000000', label: 'Lighter than air', category: 'Air', keywords: 'balloon aerostat' },
  { sidc: '140401000012010000000000000000', label: 'Civilian fixed wing', category: 'Air', keywords: 'airliner' },
  { sidc: '140401000012020000000000000000', label: 'Civilian rotary wing', category: 'Air', keywords: 'helicopter' },
  { sidc: '140602000011000000000000000000', label: 'Air missile (hostile)', category: 'Air', keywords: 'inbound cruise' },

  /* Space */
  { sidc: '140305000011070000000000000000', label: 'Satellite', category: 'Space' },
  { sidc: '140305000011110000000000000000', label: 'Communications satellite', category: 'Space', keywords: 'comsat' },
  { sidc: '140305000011150000000000000000', label: 'Reconnaissance satellite', category: 'Space', keywords: 'imagery' },
  { sidc: '140305000011140000000000000000', label: 'Navigational satellite', category: 'Space', keywords: 'GPS GNSS' },
  { sidc: '140305000011160000000000000000', label: 'Space station', category: 'Space' },
  { sidc: '140305000011190000000000000000', label: 'Space launch vehicle', category: 'Space', keywords: 'SLV rocket' },
  { sidc: '140606000011000000000000000000', label: 'Space missile (hostile)', category: 'Space', keywords: 'ballistic' },

  /* Maritime */
  { sidc: '140330000012010000000000000000', label: 'Aircraft carrier', category: 'Maritime', keywords: 'CV flattop' },
  { sidc: '140330000012020200000000000000', label: 'Cruiser', category: 'Maritime', keywords: 'CG' },
  { sidc: '140330000012020300000000000000', label: 'Destroyer', category: 'Maritime', keywords: 'DDG' },
  { sidc: '140330000012020400000000000000', label: 'Frigate', category: 'Maritime', keywords: 'FFG' },
  { sidc: '140330000012020500000000000000', label: 'Corvette', category: 'Maritime' },
  { sidc: '140330000012030300000000000000', label: 'Amphibious assault ship', category: 'Maritime', keywords: 'LHD' },
  { sidc: '140330000012030800000000000000', label: 'Landing craft', category: 'Maritime', keywords: 'LCU' },
  { sidc: '140330000012040200000000000000', label: 'Mine sweeper', category: 'Maritime', keywords: 'MCM' },
  { sidc: '140330000012050000000000000000', label: 'Patrol boat', category: 'Maritime' },
  { sidc: '140330000013010700000000000000', label: 'Hospital ship', category: 'Maritime', keywords: 'medical' },
  { sidc: '140330000013011000000000000000', label: 'Replenishment oiler', category: 'Maritime', keywords: 'AOR logistics' },
  { sidc: '140330000012070000000000000000', label: 'Unmanned surface vehicle', category: 'Maritime', keywords: 'USV drone boat' },
  { sidc: '140430000014010200000000000000', label: 'Container ship', category: 'Maritime', keywords: 'merchant' },
  { sidc: '140430000014020200000000000000', label: 'Fishing trawler', category: 'Maritime', keywords: 'merchant' },
  { sidc: '140630000012050200000000000000', label: 'Patrol ship (hostile)', category: 'Maritime', keywords: 'enemy' },
  { sidc: '140335000011010000000000000000', label: 'Submarine', category: 'Maritime', keywords: 'SSK SSN' },
  { sidc: '140335000011010100000000000000', label: 'Submarine, surfaced', category: 'Maritime' },
  { sidc: '140335000011040000000000000000', label: 'Unmanned underwater vehicle', category: 'Maritime', keywords: 'UUV AUV' },
  { sidc: '140335000011050000000000000000', label: 'Combat diver', category: 'Maritime', keywords: 'swimmer' },
  { sidc: '140635000013010000000000000000', label: 'Torpedo (hostile)', category: 'Maritime', keywords: 'weapon' },
  { sidc: '140636000011010000000000000000', label: 'Sea mine, bottom', category: 'Maritime', keywords: 'mine warfare' },
  { sidc: '140636000011020000000000000000', label: 'Sea mine, moored', category: 'Maritime', keywords: 'mine warfare' },
  { sidc: '140636000011030000000000000000', label: 'Sea mine, floating', category: 'Maritime', keywords: 'mine warfare' },
  { sidc: '140136000014010000000000000000', label: 'Mine-like contact', category: 'Maritime', keywords: 'MILCO' },
  { sidc: '140636000012000000000000000000', label: 'Unexploded ordnance', category: 'Maritime', keywords: 'UXO' },

  /* Equipment */
  { sidc: '140315003312020000000000000000', label: 'Tank, tracked', category: 'Equipment', keywords: 'armour MBT' },
  { sidc: '140315003312020200000000000000', label: 'Medium tank, tracked', category: 'Equipment', keywords: 'MBT armour' },
  { sidc: '140315003312020300000000000000', label: 'Heavy tank, tracked', category: 'Equipment', keywords: 'MBT armour' },
  { sidc: '140615003312020200000000000000', label: 'Medium tank (hostile)', category: 'Equipment', keywords: 'MBT enemy' },
  { sidc: '140315003212010300000000000000', label: 'Armoured personnel carrier, wheeled', category: 'Equipment', keywords: 'APC' },
  { sidc: '140315003312010100000000000000', label: 'Armoured fighting vehicle', category: 'Equipment', keywords: 'AFV IFV' },
  { sidc: '140315003312010200000000000000', label: 'Armoured command vehicle', category: 'Equipment', keywords: 'AFV C2' },
  { sidc: '140315003312010400000000000000', label: 'Armoured ambulance', category: 'Equipment', keywords: 'APC medical' },
  { sidc: '140315003511090200000000000000', label: 'Medium howitzer, towed', category: 'Equipment', keywords: 'artillery gun' },
  { sidc: '140315003311090300000000000000', label: 'Heavy howitzer, self-propelled', category: 'Equipment', keywords: 'artillery SPG' },
  { sidc: '140315003311160000000000000000', label: 'Multiple rocket launcher', category: 'Equipment', keywords: 'MLRS' },
  { sidc: '140315000011140200000000000000', label: 'Medium mortar', category: 'Equipment', keywords: 'indirect fire' },
  { sidc: '140315000011120200000000000000', label: 'Antitank missile launcher', category: 'Equipment', keywords: 'ATGM' },
  { sidc: '140315000011110000000000000000', label: 'Air defence missile launcher', category: 'Equipment', keywords: 'SAM' },
  { sidc: '140315003211130000000000000000', label: 'Surface-to-surface missile launcher', category: 'Equipment', keywords: 'SSM TEL' },
  { sidc: '140315000011020200000000000000', label: 'Medium machine gun', category: 'Equipment', keywords: 'MG' },
  { sidc: '140315000022030000000000000000', label: 'Radar', category: 'Equipment', keywords: 'sensor emitter' },
  { sidc: '140315000022010000000000000000', label: 'Sensor', category: 'Equipment', keywords: 'unattended ground sensor' },
  { sidc: '140315003214080000000000000000', label: 'Cross-country truck', category: 'Equipment', keywords: 'logistics' },
  { sidc: '140315003214020000000000000000', label: 'Medical vehicle', category: 'Equipment', keywords: 'ambulance' },
  { sidc: '140315000013010000000000000000', label: 'Bridge', category: 'Equipment', keywords: 'engineer gap crossing' },
  { sidc: '140315003313110100000000000000', label: 'Armoured dozer', category: 'Equipment', keywords: 'engineer' },
  { sidc: '140315003313090200000000000000', label: 'Mine clearing equipment, tank chassis', category: 'Equipment', keywords: 'breacher' },
  { sidc: '140315000020070000000000000000', label: 'Generator set', category: 'Equipment', keywords: 'power' },
  { sidc: '140615000021030000000000000000', label: 'Antitank mine', category: 'Equipment', keywords: 'minefield' },
  { sidc: '140615000021040000000000000000', label: 'Improvised explosive device', category: 'Equipment', keywords: 'IED' },

  /* Installations */
  { sidc: '140320000011030000000000000000', label: 'Ammunition cache', category: 'Installations', keywords: 'ASP depot' },
  { sidc: '140320000012070200000000000000', label: 'Medical treatment facility', category: 'Installations', keywords: 'hospital' },
  { sidc: '140320000012080200000000000000', label: 'Military base', category: 'Installations', keywords: 'camp' },
  { sidc: '140320000012080300000000000000', label: 'Airport / air base', category: 'Installations', keywords: 'airfield' },
  { sidc: '140320000012130900000000000000', label: 'Sea port / naval base', category: 'Installations', keywords: 'harbour' },
  { sidc: '140320000012120300000000000000', label: 'Telecommunications tower', category: 'Installations', keywords: 'comms mast' },
  { sidc: '140320000012050200000000000000', label: 'Power generation station', category: 'Installations', keywords: 'electricity' },
  { sidc: '140320000012050500000000000000', label: 'Petroleum / gas facility', category: 'Installations', keywords: 'oil refinery' },
  { sidc: '140320000012141100000000000000', label: 'Water treatment plant', category: 'Installations', keywords: 'utilities' },
  { sidc: '140320000012130700000000000000', label: 'Railhead', category: 'Installations', keywords: 'railway station' },
  { sidc: '140320000012140200000000000000', label: 'Dam', category: 'Installations', keywords: 'water' },
  { sidc: '140320000012130500000000000000', label: 'Helicopter landing site', category: 'Installations', keywords: 'HLS' },
  { sidc: '140420000011190100000000000000', label: 'Refugee camp', category: 'Installations', keywords: 'displaced persons tented' },
  { sidc: '140320000011200000000000000000', label: 'Warehouse / storage facility', category: 'Installations', keywords: 'depot' },
  { sidc: '140620000011170000000000000000', label: 'Safe house (hostile)', category: 'Installations' },
  { sidc: '140320000011210700000000000000', label: 'Police station', category: 'Installations', keywords: 'law enforcement' },
  { sidc: '140320000011220100000000000000', label: 'Fire station', category: 'Installations', keywords: 'emergency' },
  { sidc: '140620000011060000000000000000', label: 'CBRN facility (hostile)', category: 'Installations', keywords: 'chemical nuclear' },

  /* Activities */
  { sidc: '140640000011030000000000000000', label: 'IED event', category: 'Activities', keywords: 'improvised explosive device' },
  { sidc: '140640000011030100000000000000', label: 'IED explosion', category: 'Activities' },
  { sidc: '140640000011030300000000000000', label: 'IED cache', category: 'Activities' },
  { sidc: '140640000011060600000000000000', label: 'Bomb explosion', category: 'Activities' },
  { sidc: '140640000011040100000000000000', label: 'Sniping incident', category: 'Activities', keywords: 'shooting' },
  { sidc: '140640000011010400000000000000', label: 'Drive-by shooting', category: 'Activities' },
  { sidc: '140140000011011000000000000000', label: 'Civil rioting', category: 'Activities', keywords: 'unrest' },
  { sidc: '140440000012010000000000000000', label: 'Demonstration', category: 'Activities', keywords: 'protest' },
  { sidc: '140340000011010100000000000000', label: 'Arrest / detention', category: 'Activities' },
  { sidc: '140340000013010000000000000000', label: 'Patrolling', category: 'Activities', keywords: 'patrol' },
  { sidc: '140140000013100000000000000000', label: 'Meeting', category: 'Activities', keywords: 'shura' },
  { sidc: '140340000013110000000000000000', label: 'Raid on house', category: 'Activities' },
  { sidc: '140340000013120400000000000000', label: 'Emergency operations centre', category: 'Activities', keywords: 'EOC' },
  { sidc: '140340000013130600000000000000', label: 'Triage', category: 'Activities', keywords: 'casualty medical' },
  { sidc: '140140000015010000000000000000', label: 'Hazardous materials incident', category: 'Activities', keywords: 'HAZMAT' },
  { sidc: '140140000017020200000000000000', label: 'Flood', category: 'Activities', keywords: 'natural event' },
  { sidc: '140140000014080000000000000000', label: 'Wildfire', category: 'Activities', keywords: 'fire natural event' },
  { sidc: '140140000017010300000000000000', label: 'Earthquake epicentre', category: 'Activities', keywords: 'natural event' },
  { sidc: '140640000011011900000000000000', label: 'Smuggling', category: 'Activities', keywords: 'trafficking' },
  { sidc: '140640000011050200000000000000', label: 'Illegal drug lab', category: 'Activities', keywords: 'narcotics' },

  /* Individuals */
  { sidc: '140327000011021500000000000000', label: 'Dismounted infantryman', category: 'Individuals', keywords: 'soldier rifleman' },
  { sidc: '140327000011020900000000000000', label: 'Sniper', category: 'Individuals', keywords: 'marksman' },
  { sidc: '140327000011021200000000000000', label: 'Medic', category: 'Individuals', keywords: 'combat lifesaver' },
  { sidc: '140327000011022000000000000000', label: 'Commander', category: 'Individuals', keywords: 'CDR leader' },
  { sidc: '140327000011022100000000000000', label: 'Second in command', category: 'Individuals', keywords: 'SIC deputy' },
  { sidc: '140327000011021300000000000000', label: 'Signaller', category: 'Individuals', keywords: 'radio operator' },
  { sidc: '140327000011020600000000000000', label: 'Military policeman', category: 'Individuals', keywords: 'MP' },
  { sidc: '140327000011021400000000000000', label: 'Scout', category: 'Individuals', keywords: 'reconnaissance' },
  { sidc: '140327000011021000000000000000', label: 'Special operations soldier', category: 'Individuals', keywords: 'SOF' },
  { sidc: '140327000011020100000000000000', label: 'EOD operator', category: 'Individuals', keywords: 'bomb disposal' },
  { sidc: '140327000011030100000000000000', label: 'Rifleman', category: 'Individuals', keywords: 'lethal weapon' },
  { sidc: '140311000011030000000000000000', label: 'Civilian individual', category: 'Individuals', keywords: 'person' },
  { sidc: '140411000011040000000000000000', label: 'Civilian organization', category: 'Individuals', keywords: 'group NGO' },
  { sidc: '140611000011080000000000000000', label: 'Spy', category: 'Individuals', keywords: 'agent' },
  { sidc: '140311000011020000000000000000', label: 'Government organization', category: 'Individuals', keywords: 'civil' },

  /* Control measures */
  { sidc: '140325000013010000000000000000', label: 'Action point', category: 'Control measures', keywords: 'general point' },
  { sidc: '140325000013030000000000000000', label: 'Checkpoint', category: 'Control measures', keywords: 'CP' },
  { sidc: '140325000013050000000000000000', label: 'Contact point', category: 'Control measures' },
  { sidc: '140325000013060000000000000000', label: 'Coordinating point', category: 'Control measures' },
  { sidc: '140325000013070000000000000000', label: 'Decision point', category: 'Control measures', keywords: 'DP' },
  { sidc: '140325000013090000000000000000', label: 'Entry control point', category: 'Control measures', keywords: 'ECP' },
  { sidc: '140325000013110000000000000000', label: 'Linkup point', category: 'Control measures' },
  { sidc: '140325000013120000000000000000', label: 'Passage point', category: 'Control measures', keywords: 'PP' },
  { sidc: '140325000013140000000000000000', label: 'Rally point', category: 'Control measures', keywords: 'RP' },
  { sidc: '140325000013150000000000000000', label: 'Release point', category: 'Control measures', keywords: 'RP' },
  { sidc: '140325000013160000000000000000', label: 'Start point', category: 'Control measures', keywords: 'SP' },
  { sidc: '140325000013180000000000000000', label: 'Waypoint', category: 'Control measures', keywords: 'navigation' },
  { sidc: '140325000013210000000000000000', label: 'Key terrain', category: 'Control measures' },
  { sidc: '140325000016010000000000000000', label: 'Observation post', category: 'Control measures', keywords: 'OP outpost' },
  { sidc: '140325000016030000000000000000', label: 'Target reference point', category: 'Control measures', keywords: 'TRP' },
  { sidc: '140325000018010000000000000000', label: 'Air control point', category: 'Control measures', keywords: 'ACP airspace' },
  { sidc: '140325000024060100000000000000', label: 'Point target', category: 'Control measures', keywords: 'fires' },
  { sidc: '140325000025010000000000000000', label: 'Firing point', category: 'Control measures', keywords: 'fires' },
  { sidc: '140325000032050000000000000000', label: 'Casualty collection point', category: 'Control measures', keywords: 'CCP' },
  { sidc: '140325000032010100000000000000', label: 'Ambulance exchange point', category: 'Control measures', keywords: 'AXP' },
  { sidc: '140325000032090000000000000000', label: 'Logistics release point', category: 'Control measures', keywords: 'LRP' },
  { sidc: '140325000032140000000000000000', label: 'Traffic control post', category: 'Control measures', keywords: 'TCP' },
  { sidc: '140325000032080000000000000000', label: 'Prisoner of war collection point', category: 'Control measures', keywords: 'EPW' },
  { sidc: '140325000028120000000000000000', label: 'Fort', category: 'Control measures', keywords: 'protection' },

  /* Cyber & SIGINT */
  { sidc: '140360000011090000000000000000', label: 'Cyberspace security operations', category: 'Cyber & SIGINT', keywords: 'SOC defensive' },
  { sidc: '140660000012020000000000000000', label: 'Insider threat', category: 'Cyber & SIGINT', keywords: 'threat actor' },
  { sidc: '140360000011030000000000000000', label: 'Cyber protection team', category: 'Cyber & SIGINT', keywords: 'CPT defensive' },
  { sidc: '140360000011060000000000000000', label: 'Defensive cyberspace element', category: 'Cyber & SIGINT', keywords: 'DCO' },
  { sidc: '140360000011070000000000000000', label: 'Offensive cyberspace element', category: 'Cyber & SIGINT', keywords: 'OCO' },
  { sidc: '140660000015010000000000000000', label: 'Malware', category: 'Cyber & SIGINT', keywords: 'virus threat' },
  { sidc: '140660000015020000000000000000', label: 'Phishing', category: 'Cyber & SIGINT', keywords: 'threat email' },
  { sidc: '140360000017010000000000000000', label: 'Server', category: 'Cyber & SIGINT', keywords: 'endpoint' },
  { sidc: '140360000017060000000000000000', label: 'Router', category: 'Cyber & SIGINT', keywords: 'network' },
  { sidc: '140360000013010000000000000000', label: 'Firewall', category: 'Cyber & SIGINT', keywords: 'agent network' },
  { sidc: '140360000017030300000000000000', label: 'Laptop', category: 'Cyber & SIGINT', keywords: 'endpoint PED' },
  { sidc: '140652000011010000000000000000', label: 'SIGINT land — communications intercept', category: 'Cyber & SIGINT', keywords: 'COMINT' },
  { sidc: '140652000011020000000000000000', label: 'SIGINT land — jammer', category: 'Cyber & SIGINT', keywords: 'EW' },
  { sidc: '140652000011030000000000000000', label: 'SIGINT land — radar', category: 'Cyber & SIGINT', keywords: 'ELINT' },
  { sidc: '140651000011010000000000000000', label: 'SIGINT air — communications intercept', category: 'Cyber & SIGINT', keywords: 'COMINT' },
  { sidc: '140653000011030000000000000000', label: 'SIGINT surface — radar', category: 'Cyber & SIGINT', keywords: 'ELINT' },
  { sidc: '140654000011010000000000000000', label: 'SIGINT subsurface — communications intercept', category: 'Cyber & SIGINT', keywords: 'COMINT' },
  { sidc: '140650000011030000000000000000', label: 'SIGINT space — radar', category: 'Cyber & SIGINT', keywords: 'ELINT' },

]

/**
 * Category headings in presentation order. Derived from PRESETS rather than
 * written out twice, so a new preset can never introduce a heading the UI does
 * not know about.
 */
export const PRESET_CATEGORIES: string[] = PRESETS.reduce<string[]>((acc, p) => {
  if (!acc.includes(p.category)) acc.push(p.category)
  return acc
}, [])

interface PresetRow {
  preset: Preset
  label: string
  /** label + category + keywords, lowercased, for token matching */
  hay: string
}

const rows: PresetRow[] = PRESETS.map(p => ({
  preset: p,
  label: p.label.toLowerCase(),
  hay: `${p.label} ${p.category} ${p.keywords ?? ''}`.toLowerCase(),
}))

/**
 * Case-insensitive token search over label + category + keywords. Every token
 * must appear somewhere; a token that starts the label ranks above one that
 * merely starts a later word, which in turn beats a hit in the category or
 * keywords. A label the query spells out in full wins outright, so typing
 * "sniper" surfaces "Sniper" ahead of "Sniper team". Ties keep the curated
 * order, which is why the sort falls back to the index.
 */
export function searchPresets(query: string): Preset[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return PRESETS.slice()
  const whole = tokens.join(' ')

  const hits: Array<{ preset: Preset; score: number; order: number }> = []
  rows.forEach((row, order) => {
    let score = 0
    for (const t of tokens) {
      if (row.label.startsWith(t)) { score += 0; continue }
      // A word boundary inside the label — "medium tank" matching "tank".
      if (new RegExp(`\\b${escapeRegExp(t)}`).test(row.label)) { score += 10; continue }
      if (row.label.includes(t)) { score += 25; continue }
      if (row.hay.includes(t)) { score += 60; continue }
      score = Infinity
      break
    }
    if (row.label === whole) score -= 1
    if (Number.isFinite(score)) hits.push({ preset: row.preset, score, order })
  })

  hits.sort((a, b) => a.score - b.score || a.order - b.order)
  return hits.map(h => h.preset)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
