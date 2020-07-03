//geo & device info stuff
//data source (capital of prefectures): https://www.benricho.org/chimei/latlng_data.html
//data source :  jp.radiko.Player.V6FragmentAreaCheck.freeloc_init
export const GEO_LOCATION = {
  '北海道': [43.064615, 141.346807],
  '青森': [40.824308, 140.739998],
  '岩手': [39.703619, 141.152684],
  '宮城': [38.268837, 140.8721],
  '秋田': [39.718614, 140.102364],
  '山形': [38.240436, 140.363633],
  '福島': [37.750299, 140.467551],
  '茨城': [36.341811, 140.446793],
  '栃木': [36.565725, 139.883565],
  '群馬': [36.390668, 139.060406],
  '埼玉': [35.856999, 139.648849],
  '千葉': [35.605057, 140.123306],
  '東京': [35.689488, 139.691706],
  '神奈川': [35.447507, 139.642345],
  '新潟': [37.902552, 139.023095],
  '富山': [36.695291, 137.211338],
  '石川': [36.594682, 136.625573],
  '福井': [36.065178, 136.221527],
  '山梨': [35.664158, 138.568449],
  '長野': [36.651299, 138.180956],
  '岐阜': [35.391227, 136.722291],
  '静岡': [34.97712, 138.383084],
  '愛知': [35.180188, 136.906565],
  '三重': [34.730283, 136.508588],
  '滋賀': [35.004531, 135.86859],
  '京都': [35.021247, 135.755597],
  '大阪': [34.686297, 135.519661],
  '兵庫': [34.691269, 135.183071],
  '奈良': [34.685334, 135.832742],
  '和歌山': [34.225987, 135.167509],
  '鳥取': [35.503891, 134.237736],
  '島根': [35.472295, 133.0505],
  '岡山': [34.661751, 133.934406],
  '広島': [34.39656, 132.459622],
  '山口': [34.185956, 131.470649],
  '徳島': [34.065718, 134.55936],
  '香川': [34.340149, 134.043444],
  '愛媛': [33.841624, 132.765681],
  '高知': [33.559706, 133.531079],
  '福岡': [33.606576, 130.418297],
  '佐賀': [33.249442, 130.299794],
  '長崎': [32.744839, 129.873756],
  '熊本': [32.789827, 130.741667],
  '大分': [33.238172, 131.612619],
  '宮崎': [31.911096, 131.423893],
  '鹿児島': [31.560146, 130.557978],
  '沖縄': [26.2124, 127.680932],
}

//range detail :http://www.gsi.go.jp/KOKUJYOHO/CENTER/zenken.htm

//build number :https://www.androidpolice.com/android-build-number-date-calculator/
//https://source.android.com/setup/build-numbers

export const VERSION_MAP = {
  '5.0.0': { sdk: '21', builds: ['LRX21V', 'LRX21T', 'LRX21R', 'LRX21Q', 'LRX21P', 'LRX21O', 'LRX21M', 'LRX21L'] },
  '5.0.1': { sdk: '21', builds: ['LRX22C'] },
  '5.0.2': { sdk: '21', builds: ['LRX22L', 'LRX22G'] },
  '5.1.0': { sdk: '22', builds: ['LMY47O', 'LMY47M', 'LMY47I', 'LMY47E', 'LMY47D'] },
  '5.1.1': { sdk: '22', builds: ['LMY49M', 'LMY49J', 'LMY49I', 'LMY49H', 'LMY49G', 'LMY49F', 'LMY48Z', 'LYZ28N', 'LMY48Y', 'LMY48X', 'LMY48W', 'LVY48H', 'LYZ28M', 'LMY48U', 'LMY48T', 'LVY48F', 'LYZ28K', 'LMY48P', 'LMY48N', 'LMY48M', 'LVY48E', 'LYZ28J', 'LMY48J', 'LMY48I', 'LVY48C', 'LMY48G', 'LYZ28E', 'LMY47Z', 'LMY48B', 'LMY47X', 'LMY47V'] },
  '6.0.0': { sdk: '23', builds: ['MMB29N', 'MDB08M', 'MDB08L', 'MDB08K', 'MDB08I', 'MDA89E', 'MDA89D', 'MRA59B', 'MRA58X', 'MRA58V', 'MRA58U', 'MRA58N', 'MRA58K'] },
  '6.0.1': { sdk: '23', builds: ['MOI10E', 'MOB31Z', 'MOB31T', 'MOB31S', 'M4B30Z', 'MOB31K', 'MMB31C', 'M4B30X', 'MOB31H', 'MMB30Y', 'MTC20K', 'MOB31E', 'MMB30W', 'MXC89L', 'MTC20F', 'MOB30Y', 'MOB30X', 'MOB30W', 'MMB30S', 'MMB30R', 'MXC89K', 'MTC19Z', 'MTC19X', 'MOB30P', 'MOB30O', 'MMB30M', 'MMB30K', 'MOB30M', 'MTC19V', 'MOB30J', 'MOB30I', 'MOB30H', 'MOB30G', 'MXC89H', 'MXC89F', 'MMB30J', 'MTC19T', 'M5C14J', 'MOB30D', 'MHC19Q', 'MHC19J', 'MHC19I', 'MMB29X', 'MXC14G', 'MMB29V', 'MXB48T', 'MMB29U', 'MMB29R', 'MMB29Q', 'MMB29T', 'MMB29S', 'MMB29P', 'MMB29O', 'MXB48K', 'MXB48J', 'MMB29M', 'MMB29K'] },
  '7.0.0': { sdk: '24', builds: ['NBD92Q', 'NBD92N', 'NBD92G', 'NBD92F', 'NBD92E', 'NBD92D', 'NBD91Z', 'NBD91Y', 'NBD91X', 'NBD91U', 'N5D91L', 'NBD91P', 'NRD91K', 'NRD91N', 'NBD90Z', 'NBD90X', 'NBD90W', 'NRD91D', 'NRD90U', 'NRD90T', 'NRD90S', 'NRD90R', 'NRD90M'] },
  '7.1.0': { sdk: '25', builds: ['NDE63X', 'NDE63V', 'NDE63U', 'NDE63P', 'NDE63L', 'NDE63H'] },
  '7.1.1': { sdk: '25', builds: ['N9F27M', 'NGI77B', 'N6F27M', 'N4F27P', 'N9F27L', 'NGI55D', 'N4F27O', 'N8I11B', 'N9F27H', 'N6F27I', 'N4F27K', 'N9F27F', 'N6F27H', 'N4F27I', 'N9F27C', 'N6F27E', 'N4F27E', 'N6F27C', 'N4F27B', 'N6F26Y', 'NOF27D', 'N4F26X', 'N4F26U', 'N6F26U', 'NUF26N', 'NOF27C', 'NOF27B', 'N4F26T', 'NMF27D', 'NMF26X', 'NOF26W', 'NOF26V', 'N6F26R', 'NUF26K', 'N4F26Q', 'N4F26O', 'N6F26Q', 'N4F26M', 'N4F26J', 'N4F26I', 'NMF26V', 'NMF26U', 'NMF26R', 'NMF26Q', 'NMF26O', 'NMF26J', 'NMF26H', 'NMF26F'] },
  '7.1.2': { sdk: '25', builds: ['N2G48H', 'NZH54D', 'NKG47S', 'NHG47Q', 'NJH47F', 'N2G48C', 'NZH54B', 'NKG47M', 'NJH47D', 'NHG47O', 'N2G48B', 'N2G47Z', 'NJH47B', 'NJH34C', 'NKG47L', 'NHG47N', 'N2G47X', 'N2G47W', 'NHG47L', 'N2G47T', 'N2G47R', 'N2G47O', 'NHG47K', 'N2G47J', 'N2G47H', 'N2G47F', 'N2G47E', 'N2G47D'] },
  '8.0.0': { sdk: '26', builds: ['5650811', '5796467', '5948681', '6107732', '6127070'] },
  '8.1.0': { sdk: '27', builds: ['5794017', '6107733', '6037697'] },
  '9.0.0': { sdk: '28', builds: ['5948683', '5794013', '6127072'] },
  '10.0.0': { sdk: '29', builds: ['5933585'] },
}

export const MODEL_LIST = [
  'SC-02H', 'SCV33', 'SM-G935F', 'SM-G935X', 'SM-G935W8', 'SM-G935K', 'SM-G935L', 'SM-G935S', 'SAMSUNG-SM-G935A', 'SM-G935VC', 'SM-G9350', 'SM-G935P', 'SM-G935T', 'SM-G935U', 'SM-G935R4', 'SM-G935V', 'SC-02J', 'SCV36', 'SM-G950F', 'SM-G950N', 'SM-G950W', 'SM-G9500', 'SM-G9508', 'SM-G950U', 'SM-G950U1', 'SM-G892A', 'SM-G892U', 'SC-03J', 'SCV35', 'SM-G955F', 'SM-G955N', 'SM-G955W', 'SM-G9550', 'SM-G955U', 'SM-G955U1', 'SM-G960F', 'SM-G960N', 'SM-G9600', 'SM-G9608', 'SM-G960W', 'SM-G960U', 'SM-G960U1', 'SM-G965F', 'SM-G965N', 'SM-G9650', 'SM-G965W', 'SM-G965U', 'SM-G965U1',
  //Samsung galaxy s7+
  'SC-01J', 'SCV34', 'SM-N930F', 'SM-N930X', 'SM-N930K', 'SM-N930L', 'SM-N930S', 'SM-N930R7', 'SAMSUNG-SM-N930A', 'SM-N930W8', 'SM-N9300', 'SGH-N037', 'SM-N930R6', 'SM-N930P', 'SM-N930VL', 'SM-N930T', 'SM-N930U', 'SM-N930R4', 'SM-N930V', 'SC-01K', 'SCV37', 'SM-N950F', 'SM-N950N', 'SM-N950XN', 'SM-N950U', 'SM-N9500', 'SM-N9508', 'SM-N950W', 'SM-N950U1',
  //samsung galaxy note
  'WX06K', '404KC', '503KC', '602KC', 'KYV32', 'E6782', 'KYL22', 'WX04K', 'KYV36', 'KYL21', '302KC', 'KYV36', 'KYV42', 'KYV37', 'C5155', 'SKT01', 'KYY24', 'KYV35', 'KYV41', 'E6715', 'KYY21', 'KYY22', 'KYY23', 'KYV31', 'KYV34', 'KYV38', 'WX10K', 'KYL23', 'KYV39', 'KYV40',
  //KYOCERA
  'C6902', 'C6903', 'C6906', 'C6916', 'C6943', 'L39h', 'L39t', 'L39u', 'SO-01F', 'SOL23', 'D5503', 'M51w', 'SO-02F', 'D6502', 'D6503', 'D6543', 'SO-03F', 'SGP511', 'SGP512', 'SGP521', 'SGP551', 'SGP561', 'SO-05F', 'SOT21', 'D6563', '401SO', 'D6603', 'D6616', 'D6643', 'D6646', 'D6653', 'SO-01G', 'SOL26', 'D6603', 'D5803', 'D5833', 'SO-02G', 'D5803', 'D6633', 'D6683', 'SGP611', 'SGP612', 'SGP621', 'SGP641', 'E6553', 'E6533', 'D6708', '402SO', 'SO-03G', 'SOV31', 'SGP712', 'SGP771', 'SO-05G', 'SOT31', 'E6508', '501SO', 'E6603', 'E6653', 'SO-01H', 'SOV32', 'E5803', 'E5823', 'SO-02H', 'E6853', 'E6883', 'SO-03H', 'E6833', 'E6633', 'E6683', 'C6502', 'C6503', 'C6506', 'L35h', 'SOL25', 'C5306', 'C5502', 'C5503', '601SO', 'F8331', 'F8332', 'SO-01J', 'SOV34', 'G8141', 'G8142', 'G8188', 'SO-04J', '701SO', 'G8341', 'G8342', 'G8343', 'SO-01K', 'SOV36', 'G8441', 'SO-02K', '602SO', 'G8231', 'G8232', 'SO-03J', 'SOV35',
  //sony xperia z series
  '605SH', 'SH-03J', 'SHV39', '701SH', 'SH-M06',
  //sharp
  '101F', '201F', '202F', '301F', 'IS12F', 'F-03D', 'F-03E', 'M01', 'M305', 'M357', 'M555', 'M555', 'F-11D', 'F-06E', 'EM01F', 'F-05E', 'FJT21', 'F-01D', 'FAR70B', 'FAR7', 'F-04E', 'F-02E', 'F-10D', 'F-05D', 'FJL22', 'ISW11F', 'ISW13F', 'FJL21', 'F-074', 'F-07D',
  //fujitu arrows
]

export const APP_VERSIONS = [
  '7.2.0',
  '7.1.13',
  '7.1.12',
  '7.1.11',
  '7.1.1',
  '7.1.0',
  '7.0.9',
  '7.0.8',
  '7.0.7',
  '7.0.6',
  '7.0.5',
  '7.0.4',
  '7.0.3',
  '7.0.2',
  '7.0.1',
  '7.0.0',
  '6.4.7',
  '6.4.6',
]

export const RADIO_AREA_ID = {
  '802': {
    name: 'FM802',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  'HOUSOU-DAIGAKU': {
    name: '放送大学',
    area: ['JP1', 'JP2', 'JP3', 'JP4', 'JP5', 'JP6', 'JP7', 'JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14', 'JP15', 'JP16', 'JP17', 'JP18', 'JP19', 'JP20', 'JP21', 'JP22', 'JP23', 'JP24', 'JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30', 'JP31', 'JP32', 'JP33', 'JP34', 'JP35', 'JP36', 'JP37', 'JP38', 'JP39', 'JP40', 'JP41', 'JP42', 'JP43', 'JP44', 'JP45', 'JP46', 'JP47']
  },
  'ALPHA-STATION': {
    name: 'α-STATION FM京都',
    area: ['JP26']
  },
  HBC: {
    name: 'ＨＢＣラジオ',
    area: ['JP1']
  },
  CCL: {
    name: 'FM COCOLO',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  FMAICHI: {
    name: 'FM AICHI',
    area: ['JP21', 'JP23', 'JP24']
  },
  BAYFM78: {
    name: 'bayfm78',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  'FM-FUJI': {
    name: 'FM FUJI',
    area: ['JP19']
  },
  RAB: {
    name: 'ＲＡＢ青森放送',
    area: ['JP2']
  },
  'JOAK-FM': {
    name: 'NHK-FM（東京）',
    area: ['JP1', 'JP2', 'JP3', 'JP4', 'JP5', 'JP6', 'JP7', 'JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14', 'JP15', 'JP16', 'JP17', 'JP18', 'JP19', 'JP20', 'JP21', 'JP22', 'JP23', 'JP24', 'JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30', 'JP31', 'JP32', 'JP33', 'JP34', 'JP35', 'JP36', 'JP37', 'JP38', 'JP39', 'JP40', 'JP41', 'JP42', 'JP43', 'JP44', 'JP45', 'JP46', 'JP47']
  },
  JOLK: {
    name: 'NHKラジオ第1（福岡）',
    area: ['JP40', 'JP41', 'JP42', 'JP43', 'JP44', 'JP45', 'JP46', 'JP47']
  },
  FMNAGASAKI: {
    name: 'FM長崎',
    area: ['JP42']
  },
  RKB: {
    name: 'RKBラジオ',
    area: ['JP40']
  },
  JOIK: {
    name: 'NHKラジオ第1（札幌）',
    area: ['JP1']
  },
  MRT: {
    name: '宮崎放送',
    area: ['JP45']
  },
  'K-MIX': {
    name: 'K-MIX SHIZUOKA',
    area: ['JP22']
  },
  KNB: {
    name: 'ＫＮＢラジオ',
    area: ['JP16']
  },
  TOKAIRADIO: {
    name: '東海ラジオ',
    area: ['JP21', 'JP23', 'JP24']
  },
  MRO: {
    name: 'MROラジオ',
    area: ['JP17']
  },
  YBS: {
    name: 'YBSラジオ',
    area: ['JP19']
  },
  JOYFM: {
    name: 'エフエム宮崎',
    area: ['JP45']
  },
  HELLOFIVE: {
    name: 'エフエム石川',
    area: ['JP17']
  },
  CROSSFM: {
    name: 'cross fm',
    area: ['JP40']
  },
  FMNIIGATA: {
    name: 'FM NIIGATA',
    area: ['JP15']
  },
  RKK: {
    name: 'RKKラジオ',
    area: ['JP43']
  },
  INT: {
    name: 'InterFM897',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  'FM-OKAYAMA': {
    name: 'ＦＭ岡山',
    area: ['JP33']
  },
  CRT: {
    name: 'CRT栃木放送',
    area: ['JP9']
  },
  FMKAGAWA: {
    name: 'FM香川',
    area: ['JP37']
  },
  FMFUKUI: {
    name: 'FM福井',
    area: ['JP18']
  },
  RADIOBERRY: {
    name: 'RadioBerry',
    area: ['JP9']
  },
  CRK: {
    name: 'ラジオ関西',
    area: ['JP26', 'JP27', 'JP28']
  },
  RN1: {
    name: 'ラジオNIKKEI第1 ',
    area: ['JP1', 'JP2', 'JP3', 'JP4', 'JP5', 'JP6', 'JP7', 'JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14', 'JP15', 'JP16', 'JP17', 'JP18', 'JP19', 'JP20', 'JP21', 'JP22', 'JP23', 'JP24', 'JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30', 'JP31', 'JP32', 'JP33', 'JP34', 'JP35', 'JP36', 'JP37', 'JP38', 'JP39', 'JP40', 'JP41', 'JP42', 'JP43', 'JP44', 'JP45', 'JP46', 'JP47']
  },
  YBC: {
    name: 'YBC山形放送',
    area: ['JP6']
  },
  JOBK: {
    name: 'NHKラジオ第1（大阪）',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  ROK: {
    name: 'ラジオ沖縄',
    area: ['JP47']
  },
  RADIONEO: {
    name: 'RADIO NEO',
    area: ['JP21', 'JP23', 'JP24']
  },
  KBC: {
    name: 'KBCラジオ',
    area: ['JP40']
  },
  KBS: {
    name: 'KBS京都ラジオ ',
    area: ['JP25', 'JP26']
  },
  FMFUKUOKA: {
    name: 'FM FUKUOKA ',
    area: ['JP40']
  },
  AFM: {
    name: 'エフエム秋田',
    area: ['JP5']
  },
  AFB: {
    name: 'エフエム青森',
    area: ['JP2']
  },
  NORTHWAVE: {
    name: 'FM NORTH WAVE',
    area: ['JP1']
  },
  RFC: {
    name: 'RFCラジオ福島',
    area: ['JP7']
  },
  'E-RADIO': {
    name: 'e-radio FM滋賀',
    area: ['JP25']
  },
  RFM: {
    name: 'Rhythm Station　エフエム山形',
    area: ['JP6']
  },
  JOCK: {
    name: 'NHKラジオ第1（名古屋）',
    area: ['JP16', 'JP17', 'JP18', 'JP21', 'JP22', 'JP23', 'JP24']
  },
  CBC: {
    name: 'CBCラジオ',
    area: ['JP21', 'JP23', 'JP24']
  },
  FMY: {
    name: 'エフエム山口',
    area: ['JP35']
  },
  RNC: {
    name: 'RNC西日本放送',
    area: ['JP37']
  },
  RNB: {
    name: 'RNB南海放送',
    area: ['JP38']
  },
  TBS: {
    name: 'TBSラジオ',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  JOZK: {
    name: 'NHKラジオ第1（松山）',
    area: ['JP36', 'JP37', 'JP38', 'JP39']
  },
  TBC: {
    name: 'TBCラジオ',
    area: ['JP4']
  },
  HFM: {
    name: '広島FM',
    area: ['JP34']
  },
  FMTOYAMA: {
    name: 'ＦＭとやま',
    area: ['JP16']
  },
  'HI-SIX': {
    name: 'エフエム高知',
    area: ['JP39']
  },
  FMMIE: {
    name: 'レディオキューブ ＦＭ三重',
    area: ['JP24']
  },
  BSS: {
    name: 'BSSラジオ',
    area: ['JP31', 'JP32']
  },
  BSN: {
    name: 'ＢＳＮラジオ',
    area: ['JP15']
  },
  LFR: {
    name: 'ニッポン放送',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  NBC: {
    name: 'NBC長崎放送',
    area: ['JP42']
  },
  JOHK: {
    name: 'NHKラジオ第1（仙台）',
    area: ['JP2', 'JP3', 'JP4', 'JP5', 'JP6', 'JP7']
  },
  KRY: {
    name: 'ＫＲＹ山口放送',
    area: ['JP35']
  },
  JORF: {
    name: 'ラジオ日本',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  FMT: {
    name: 'TOKYO FM',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  OBC: {
    name: 'OBCラジオ大阪',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  FMN: {
    name: 'ＦＭ長野',
    area: ['JP20']
  },
  FMO: {
    name: 'FM大阪',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  FMJ: {
    name: 'J-WAVE',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  FMK: {
    name: 'FMKエフエム熊本',
    area: ['JP43']
  },
  FMI: {
    name: 'エフエム岩手',
    area: ['JP3']
  },
  FMF: {
    name: 'ふくしまFM',
    area: ['JP7']
  },
  JOAK: {
    name: 'NHKラジオ第1（東京）',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14', 'JP15', 'JP19', 'JP20']
  },
  OBS: {
    name: 'OBSラジオ',
    area: ['JP44']
  },
  FM_OITA: {
    name: 'エフエム大分',
    area: ['JP44']
  },
  SBS: {
    name: 'SBSラジオ',
    area: ['JP22']
  },
  FBC: {
    name: 'FBCラジオ',
    area: ['JP18']
  },
  SBC: {
    name: 'SBCラジオ',
    area: ['JP20']
  },
  JRT: {
    name: 'ＪＲＴ四国放送',
    area: ['JP36']
  },
  KISSFMKOBE: {
    name: 'Kiss FM KOBE',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  DATEFM: {
    name: 'Date fm（エフエム仙台）',
    area: ['JP4']
  },
  GBS: {
    name: 'ぎふチャン',
    area: ['JP21', 'JP23', 'JP24']
  },
  WBS: {
    name: 'wbs和歌山放送',
    area: ['JP30']
  },
  IBC: {
    name: 'IBCラジオ',
    area: ['JP3']
  },
  JOFK: {
    name: 'NHKラジオ第1（広島）',
    area: ['JP31', 'JP32', 'JP33', 'JP34', 'JP35']
  },
  NACK5: {
    name: 'NACK5',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  IBS: {
    name: 'IBS茨城放送',
    area: ['JP8']
  },
  RCC: {
    name: 'RCCラジオ',
    area: ['JP34']
  },
  'FM-SANIN': {
    name: 'エフエム山陰',
    area: ['JP31', 'JP32']
  },
  YFM: {
    name: 'ＦＭヨコハマ',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  'ZIP-FM': {
    name: 'ZIP-FM',
    area: ['JP21', 'JP23', 'JP24']
  },
  MBC: {
    name: 'ＭＢＣラジオ',
    area: ['JP46']
  },
  QRR: {
    name: '文化放送',
    area: ['JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14']
  },
  FMGUNMA: {
    name: 'FM GUNMA',
    area: ['JP10']
  },
  RKC: {
    name: 'RKC高知放送',
    area: ['JP39']
  },
  MBS: {
    name: 'MBSラジオ',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  FM_OKINAWA: {
    name: 'FM沖縄',
    area: ['JP47']
  },
  ABC: {
    name: 'ABCラジオ',
    area: ['JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30']
  },
  'JOEU-FM': {
    name: 'FM愛媛',
    area: ['JP38']
  },
  STV: {
    name: 'ＳＴＶラジオ',
    area: ['JP1']
  },
  ABS: {
    name: 'ABS秋田放送',
    area: ['JP5']
  },
  RN2: {
    name: 'ラジオNIKKEI第2',
    area: ['JP1', 'JP2', 'JP3', 'JP4', 'JP5', 'JP6', 'JP7', 'JP8', 'JP9', 'JP10', 'JP11', 'JP12', 'JP13', 'JP14', 'JP15', 'JP16', 'JP17', 'JP18', 'JP19', 'JP20', 'JP21', 'JP22', 'JP23', 'JP24', 'JP25', 'JP26', 'JP27', 'JP28', 'JP29', 'JP30', 'JP31', 'JP32', 'JP33', 'JP34', 'JP35', 'JP36', 'JP37', 'JP38', 'JP39', 'JP40', 'JP41', 'JP42', 'JP43', 'JP44', 'JP45', 'JP46', 'JP47']
  },
  LOVEFM: {
    name: 'LOVE FM',
    area: ['JP40']
  },
  RBC: {
    name: 'RBCiラジオ',
    area: ['JP47']
  },
  RSK: {
    name: 'ＲＳＫラジオ',
    area: ['JP33']
  },
  'AIR-G': {
    name: 'AIR-G\'（FM北海道）',
    area: ['JP1']
  },
  FMGIFU: {
    name: 'ＦＭ ＧＩＦＵ',
    area: ['JP21']
  },
  FMPORT: {
    name: 'FM PORT',
    area: ['JP15']
  },
  MYUFM: {
    name: 'μＦＭ',
    area: ['JP46']
  }
}
