export function getLocalSubjectsFallback() {
  const S = [
    ["GRGRBIL01", "Bild"],
    ["GRGRBIO01", "Biologi"],
    ["GRGRDAN01", "Dans"],
    ["GRGRENG01", "Engelska"],
    ["GRGRFYS01", "Fysik"],
    ["GRGRGEO01", "Geografi"],
    ["GRGRHKK01", "Hem- och konsumentkunskap"],
    ["GRGRHIS01", "Historia"],
    ["GRGRIDR01", "Idrott och hälsa"],
    ["GRGRJUD01", "Judiska studier"],
    ["GRGRKEM01", "Kemi"],
    ["GRGRMAT01", "Matematik"],
    // Moderna språk/Modersmål kräver språkkoder → utelämnas i fallback
    ["GRGRMUS01", "Musik"],
    ["GRGRREL01", "Religionskunskap"],
    ["GRGRSAM01", "Samhällskunskap"],
    ["GRGRSLJ01", "Slöjd"],
    ["GRGRSVE01", "Svenska"],
    ["GRGRSVA01", "Svenska som andraspråk"],
    ["GRGRTSP01", "Teckenspråk för hörande"],
    ["GRGRTEK01", "Teknik"],
    ["GRSMSMI01", "Samiska"],
  ];
  return S.map(([id, name]) => ({ id, name }));
}
