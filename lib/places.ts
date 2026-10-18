// Cities and historic places that routes on video maps can stop at, so their coordinates come from open data and
// never from the model's memory. A name finds its place in any common spelling: without accents or punctuation, by an
// old name like Constantinople for Istanbul, or with a note after it, like "Calicut, India".
//
// Coordinates come from Natural Earth 10m populated places (public domain, naturalearthdata.com), rounded to 0.01
// degrees, about 1 km. Historic sites and small places that Natural Earth leaves out come from Wikidata (CC0); their
// lines name the Wikidata item, like Q5684 for Babylon. Each place lies in its country on the map, or within 5 km of
// its simplified coast, except the Banda Islands and Cape Horn, too small for the map to draw.
// `country` is the ISO 3166-1 alpha-3 code of the country the place lies in today, as the maps draw it
// (lib/countries.ts and lib/world.ts), so Crimea is in Ukraine.
// When two places share a name, the one an explainer video most likely means gets it, like Memphis in Egypt, and the
// other goes by a longer name, like "Memphis, Tennessee". No name leads to two places.

import { namesCountry, namesRegionOf } from "./regions.ts";

export type Place = { name: string; lon: number; lat: number; country: string };

// [name, country, longitude, latitude, other names...]
const PLACES: [string, string, number, number, ...string[]][] = [
  // Europe and Russia
  ["A Coruña", "ESP", -8.42, 43.33, "La Coruña", "Corunna"],
  ["Amsterdam", "NLD", 4.91, 52.35],
  ["Antwerp", "BEL", 4.41, 51.22, "Antwerpen", "Anvers"],
  ["Archangel", "RUS", 40.55, 64.57, "Arkhangelsk"],
  ["Astrakhan", "RUS", 48.05, 46.35],
  ["Athens", "GRC", 23.73, 37.99, "Athina"],
  ["Barcelona", "ESP", 2.18, 41.39, "Barcino"],
  ["Belfast", "GBR", -5.93, 54.59],
  ["Belgrade", "SRB", 20.47, 44.82, "Singidunum", "Beograd"],
  ["Bergen", "NOR", 5.32, 60.39],
  ["Berlin", "DEU", 13.4, 52.52],
  ["Bern", "CHE", 7.47, 46.92],
  ["Birmingham", "GBR", -1.92, 52.48],
  ["Bordeaux", "FRA", -0.6, 44.85],
  ["Bratislava", "SVK", 17.12, 48.15, "Pressburg", "Pozsony"],
  ["Bremen", "DEU", 8.8, 53.08],
  ["Brindisi", "ITA", 17.93, 40.64, "Brundisium"],
  ["Bristol", "GBR", -2.58, 51.45],
  ["Bruges", "BEL", 3.23, 51.22, "Brugge"],
  ["Brussels", "BEL", 4.33, 50.84],
  ["Bucharest", "ROU", 26.1, 44.44],
  ["Budapest", "HUN", 19.08, 47.5],
  ["Cádiz", "ESP", -6.29, 36.52, "Gades"],
  ["Calais", "FRA", 1.83, 50.95],
  ["Cambridge", "GBR", 0.12, 52.2],
  ["Cardiff", "GBR", -3.17, 51.48],
  ["Chernobyl", "UKR", 30.1, 51.39, "Chornobyl"],
  ["Chișinău", "MDA", 28.86, 47.01, "Kishinev"],
  ["Cologne", "DEU", 6.95, 50.93, "Köln", "Colonia Agrippina"],
  ["Constanța", "ROU", 28.61, 44.2, "Tomis"],
  ["Copenhagen", "DNK", 12.56, 55.68, "København"],
  ["Córdoba", "ESP", -4.77, 37.88, "Cordova", "Corduba"],
  ["Cork", "IRL", -8.47, 51.89, "Cobh", "Queenstown"],
  ["Dover", "GBR", 1.3, 51.13],
  ["Dresden", "DEU", 13.75, 51.05],
  ["Dublin", "IRL", -6.26, 53.35],
  ["Dubrovnik", "HRV", 18.09, 42.66, "Ragusa"],
  ["Edinburgh", "GBR", -3.22, 55.95],
  ["Florence", "ITA", 11.25, 43.78, "Firenze"],
  ["Frankfurt", "DEU", 8.68, 50.1, "Frankfurt am Main"],
  ["Funchal", "PRT", -16.88, 32.65, "Madeira"],
  ["Gdańsk", "POL", 18.64, 54.36, "Danzig"],
  ["Geneva", "CHE", 6.14, 46.21, "Genève"],
  ["Genoa", "ITA", 8.93, 44.41, "Genova"],
  ["Ghent", "BEL", 3.7, 51.03, "Gent", "Gand"],
  ["Glasgow", "GBR", -4.24, 55.86],
  ["Gothenburg", "SWE", 11.98, 57.71, "Göteborg"],
  ["Granada", "ESP", -3.59, 37.16],
  ["Hamburg", "DEU", 10, 53.55],
  ["Helsinki", "FIN", 24.93, 60.16, "Helsingfors"],
  ["Heraklion", "GRC", 25.13, 35.33, "Iraklio", "Iraklion", "Candia"],
  ["Irkutsk", "RUS", 104.28, 52.28],
  ["Kaliningrad", "RUS", 20.5, 54.7, "Königsberg", "Koenigsberg"],
  ["Kazan", "RUS", 49.12, 55.75],
  ["Kerch", "UKR", 36.49, 45.37],
  ["Kraków", "POL", 19.96, 50.06, "Cracow"],
  ["Kursk", "RUS", 36.19, 51.74],
  ["Kyiv", "UKR", 30.51, 50.44, "Kiev"],
  ["Las Palmas", "ESP", -15.43, 28.1, "Las Palmas de Gran Canaria", "Gran Canaria", "Canary Islands", "Canaries"],
  ["Le Havre", "FRA", 0.1, 49.5],
  ["Leipzig", "DEU", 12.41, 51.34],
  ["Lisbon", "PRT", -9.15, 38.72, "Lisboa", "Olisipo"],
  ["Liverpool", "GBR", -2.96, 53.41],
  ["Ljubljana", "SVN", 14.51, 46.06, "Laibach"],
  ["London", "GBR", -0.12, 51.5, "Londinium"],
  ["Lübeck", "DEU", 10.67, 53.87],
  ["Luxembourg", "LUX", 6.13, 49.61, "Luxembourg City"],
  ["Lviv", "UKR", 24.03, 49.83, "Lemberg", "Lwów", "Lvov"],
  ["Lyon", "FRA", 4.83, 45.77, "Lyons", "Lugdunum"],
  ["Madrid", "ESP", -3.69, 40.4],
  ["Manchester", "GBR", -2.25, 53.48],
  ["Marseille", "FRA", 5.37, 43.29, "Marseilles", "Massalia", "Massilia"],
  ["Messina", "ITA", 15.55, 38.2],
  ["Milan", "ITA", 9.2, 45.47, "Milano", "Mediolanum"],
  ["Minsk", "BLR", 27.56, 53.9],
  ["Moscow", "RUS", 37.61, 55.75, "Moskva", "Muscovy"],
  ["Munich", "DEU", 11.57, 48.13, "München"],
  ["Murmansk", "RUS", 33.1, 68.97],
  ["Nantes", "FRA", -1.59, 47.21],
  ["Naples", "ITA", 14.24, 40.84, "Napoli", "Neapolis"],
  ["Narva", "EST", 28.16, 59.38],
  ["Nicosia", "CYP", 33.37, 35.17],
  ["Novgorod", "RUS", 31.33, 58.5, "Veliky Novgorod", "Holmgard"],
  ["Nuremberg", "DEU", 11.08, 49.45, "Nürnberg"],
  ["Odesa", "UKR", 30.71, 46.49, "Odessa"],
  ["Orléans", "FRA", 1.9, 47.9],
  ["Oslo", "NOR", 10.75, 59.92, "Christiania", "Kristiania"],
  ["Oxford", "GBR", -1.25, 51.75],
  ["Palermo", "ITA", 13.35, 38.13, "Panormus"],
  ["Palma", "ESP", 2.65, 39.57, "Palma de Mallorca", "Mallorca", "Majorca"],
  ["Paris", "FRA", 2.35, 48.86, "Lutetia"],
  ["Pisa", "ITA", 10.4, 43.72],
  ["Plymouth", "GBR", -4.16, 50.39],
  ["Podgorica", "MNE", 19.27, 42.47],
  ["Ponta Delgada", "PRT", -25.67, 37.75, "Azores"],
  ["Porto", "PRT", -8.62, 41.15, "Oporto"],
  ["Portsmouth", "GBR", -1.08, 50.8],
  ["Potsdam", "DEU", 13.07, 52.4],
  ["Prague", "CZE", 14.42, 50.09, "Praha"],
  ["Pristina", "XKX", 21.17, 42.67, "Prishtina"],
  ["Ravenna", "ITA", 12.22, 44.42],
  ["Reims", "FRA", 4.03, 49.25, "Rheims"],
  ["Reykjavík", "ISL", -21.94, 64.14],
  ["Rhodes", "GRC", 28.22, 36.44, "Rodos"],
  ["Riga", "LVA", 24.1, 56.95],
  ["Rome", "ITA", 12.48, 41.9, "Roma"],
  ["Rotterdam", "NLD", 4.48, 51.92],
  ["Rouen", "FRA", 1.08, 49.43],
  ["Saint Petersburg", "RUS", 30.31, 59.94, "Leningrad", "Petrograd", "Sankt-Peterburg"],
  ["Santiago de Compostela", "ESP", -8.54, 42.88, "Compostela"],
  ["Sarajevo", "BIH", 18.38, 43.85],
  ["Sevastopol", "UKR", 33.52, 44.6],
  ["Seville", "ESP", -5.98, 37.41, "Sevilla", "Hispalis"],
  ["Skopje", "MKD", 21.43, 42],
  ["Sofia", "BGR", 23.31, 42.69, "Serdica"],
  ["Southampton", "GBR", -1.4, 50.9],
  ["Sparta", "GRC", 22.43, 37.07, "Sparti"],
  ["Stockholm", "SWE", 18.07, 59.32],
  ["Strasbourg", "FRA", 7.75, 48.58, "Strassburg"],
  ["Syracuse", "ITA", 15.29, 37.07, "Siracusa", "Syracusae"],
  ["Tallinn", "EST", 24.73, 59.43, "Reval"],
  ["The Hague", "NLD", 4.27, 52.08],
  ["Thessaloniki", "GRC", 22.88, 40.7, "Salonica", "Thessalonica", "Salonika"],
  ["Tirana", "ALB", 19.82, 41.33],
  ["Toledo", "ESP", -4.02, 39.87],
  ["Trieste", "ITA", 13.8, 45.65],
  ["Trondheim", "NOR", 10.42, 63.42, "Nidaros"],
  ["Turin", "ITA", 7.67, 45.07, "Torino"],
  ["Uppsala", "SWE", 17.64, 59.86],
  ["Valencia", "ESP", -0.4, 39.49],
  ["Valletta", "MLT", 14.51, 35.9, "Malta"],
  ["Varna", "BGR", 27.9, 43.22],
  ["Vatican City", "VAT", 12.45, 41.9, "Vatican"],
  ["Venice", "ITA", 12.33, 45.44, "Venezia"],
  ["Vienna", "AUT", 16.36, 48.2, "Wien", "Vindobona"],
  ["Vilnius", "LTU", 25.32, 54.68, "Vilna", "Wilno"],
  ["Visby", "SWE", 18.3, 57.63, "Gotland"],
  ["Vladivostok", "RUS", 131.91, 43.13],
  ["Volgograd", "RUS", 44.5, 48.71, "Stalingrad", "Tsaritsyn"],
  ["Warsaw", "POL", 21.01, 52.23, "Warszawa"],
  ["Wrocław", "POL", 17.03, 51.11, "Breslau"],
  ["Yalta", "UKR", 34.16, 44.5],
  ["Yekaterinburg", "RUS", 60.6, 56.85, "Sverdlovsk"],
  ["York", "GBR", -1.07, 53.95, "Jorvik", "Eboracum"],
  ["Zagreb", "HRV", 16, 45.8, "Agram"],
  // Middle East and North Africa
  ["Abu Dhabi", "ARE", 54.37, 24.47],
  ["Aden", "YEM", 45.01, 12.78],
  ["Aleppo", "SYR", 37.17, 36.23, "Halab"],
  ["Alexandria", "EGY", 29.95, 31.2, "Alexandreia", "Iskandariya"],
  ["Algiers", "DZA", 3.05, 36.77, "Alger"],
  ["Amman", "JOR", 35.93, 31.95],
  ["Ankara", "TUR", 32.86, 39.93, "Angora", "Ancyra"],
  ["Antakya", "TUR", 36.12, 36.23, "Antioch", "Antiochia"],
  ["Aqaba", "JOR", 35.08, 29.53, "Al Aqabah"],
  ["Aswan", "EGY", 32.9, 24.09, "Syene"],
  ["Baghdad", "IRQ", 44.39, 33.34],
  ["Bandar Abbas", "IRN", 56.27, 27.2, "Bandar-e Abbas", "Gombroon"],
  ["Basra", "IRQ", 47.81, 30.52, "Basrah"],
  ["Beirut", "LBN", 35.51, 33.87, "Berytus"],
  ["Benghazi", "LBY", 20.06, 32.12, "Banghazi"],
  ["Berenice", "EGY", 35.48, 23.95, "Berenike"],
  ["Bursa", "TUR", 29.07, 40.2, "Prusa"],
  ["Cairo", "EGY", 31.25, 30.05],
  ["Canakkale", "TUR", 26.41, 40.15],
  ["Casablanca", "MAR", -7.62, 33.6],
  ["Damascus", "SYR", 36.3, 33.5],
  ["Doha", "QAT", 51.53, 25.29],
  ["Dubai", "ARE", 55.29, 25.21],
  ["Edirne", "TUR", 26.57, 41.67, "Adrianople", "Hadrianopolis"],
  ["Erbil", "IRQ", 44.01, 36.18, "Arbil", "Irbil", "Arbela"],
  ["Fez", "MAR", -5, 34.06, "Fes"],
  ["Gaza", "PSE", 34.45, 31.53, "Gaza City"],
  ["Giza", "EGY", 31.19, 30.01, "El Giza"],
  ["Haifa", "ISR", 34.98, 32.82],
  ["Hamadan", "IRN", 48.52, 34.8, "Ecbatana"],
  ["Isfahan", "IRN", 51.7, 32.7, "Esfahan", "Ispahan"],
  ["Istanbul", "TUR", 28.97, 41.02, "Constantinople", "Byzantium", "Konstantinoupolis", "Stamboul", "Miklagard", "Tsargrad"],
  ["Izmir", "TUR", 27.15, 38.44, "Smyrna"],
  ["Jeddah", "SAU", 39.22, 21.52, "Jiddah", "Jidda"],
  ["Jerusalem", "ISR", 35.21, 31.78, "Al-Quds"],
  ["Kairouan", "TUN", 10.1, 35.68, "Qairouan"],
  ["Karbala", "IRQ", 44.02, 32.61],
  ["Kuwait City", "KWT", 47.98, 29.37, "Kuwait"],
  ["Luxor", "EGY", 32.65, 25.7, "Thebes"],
  ["Manama", "BHR", 50.58, 26.24],
  ["Marrakesh", "MAR", -8, 31.63, "Marrakech"],
  ["Mashhad", "IRN", 59.57, 36.27, "Meshed"],
  ["Mecca", "SAU", 39.82, 21.43, "Makkah"],
  ["Medina", "SAU", 39.58, 24.5, "Madinah", "Yathrib"],
  ["Mosul", "IRQ", 43.14, 36.35],
  ["Muscat", "OMN", 58.38, 23.59, "Masqat"],
  ["Palmyra", "SYR", 38.28, 34.55, "Tadmur"],
  ["Port Said", "EGY", 32.29, 31.26, "Bur Said"],
  ["Rabat", "MAR", -6.84, 34.03],
  ["Ramallah", "PSE", 35.21, 31.9],
  ["Riyadh", "SAU", 46.72, 24.63],
  ["Rosetta", "EGY", 30.39, 31.46, "Rashid"],
  ["Salalah", "OMN", 54.09, 17.03, "Dhofar"],
  ["Sanaa", "YEM", 44.2, 15.36],
  ["Sanliurfa", "TUR", 38.79, 37.17, "Urfa", "Edessa"],
  ["Shiraz", "IRN", 52.57, 29.63],
  ["Sidon", "LBN", 35.37, 33.56, "Saida"],
  ["Socotra", "YEM", 54.02, 12.65, "Hadiboh"],
  ["Suez", "EGY", 32.55, 30],
  ["Tabriz", "IRN", 46.3, 38.09],
  ["Tangier", "MAR", -5.81, 35.78, "Tangiers", "Tanger", "Tingis"],
  ["Tehran", "IRN", 51.42, 35.67],
  ["Tel Aviv", "ISR", 34.77, 32.08, "Tel Aviv-Yafo", "Jaffa", "Yafo", "Joppa"],
  ["Trabzon", "TUR", 39.72, 40.98, "Trebizond", "Trapezus"],
  ["Tripoli", "LBY", 13.18, 32.89, "Tarabulus al-Gharb"],
  ["Tripoli, Lebanon", "LBN", 35.83, 34.44, "Tarabulus"],
  ["Tunis", "TUN", 10.18, 36.8],
  ["Yanbu", "SAU", 38.05, 24.09],
  // Africa south of the Sahara
  ["Abidjan", "CIV", -4.02, 5.32],
  ["Abuja", "NGA", 7.49, 9.05],
  ["Accra", "GHA", -0.22, 5.55],
  ["Addis Ababa", "ETH", 38.7, 9.04],
  ["Aksum", "ETH", 38.72, 14.13, "Axum"],
  ["Antananarivo", "MDG", 47.51, -18.91],
  ["Asmara", "ERI", 38.93, 15.33],
  ["Bamako", "MLI", -8, 12.65],
  ["Bangui", "CAF", 18.56, 4.37],
  ["Banjul", "GMB", -16.59, 13.45],
  ["Benguela", "AGO", 13.41, -12.58],
  ["Benin City", "NGA", 5.62, 6.34],
  ["Bissau", "GNB", -15.6, 11.87],
  ["Bloemfontein", "ZAF", 26.23, -29.12],
  ["Brazzaville", "COG", 15.28, -4.26],
  ["Bujumbura", "BDI", 29.36, -3.38],
  ["Cape Coast", "GHA", -1.25, 5.11],
  ["Cape Town", "ZAF", 18.43, -33.92, "Kaapstad", "Table Bay"],
  ["Conakry", "GIN", -13.68, 9.53],
  ["Cotonou", "BEN", 2.4, 6.36],
  ["Dakar", "SEN", -17.48, 14.72],
  ["Dar es Salaam", "TZA", 39.27, -6.8],
  ["Djenné", "MLI", -4.55, 13.9, "Jenne"],
  ["Djibouti", "DJI", 43.15, 11.6, "Djibouti City"],
  ["Dodoma", "TZA", 35.75, -6.18],
  ["Freetown", "SLE", -13.24, 8.47],
  ["Gaborone", "BWA", 25.91, -24.65],
  ["Gao", "MLI", -0.05, 16.27],
  ["Harare", "ZWE", 31.04, -17.82, "Salisbury"],
  ["Johannesburg", "ZAF", 28.03, -26.17, "Joburg"],
  ["Juba", "SSD", 31.58, 4.83],
  ["Kampala", "UGA", 32.58, 0.32],
  ["Kano", "NGA", 8.52, 12],
  ["Khartoum", "SDN", 32.53, 15.59],
  ["Kigali", "RWA", 30.06, -1.95],
  ["Kinshasa", "COD", 15.31, -4.33, "Léopoldville"],
  ["Lagos", "NGA", 3.39, 6.45],
  ["Lamu", "KEN", 40.92, -2.26],
  ["Libreville", "GAB", 9.46, 0.39],
  ["Lilongwe", "MWI", 33.78, -13.98],
  ["Lomé", "TGO", 1.22, 6.13],
  ["Luanda", "AGO", 13.23, -8.84],
  ["Lusaka", "ZMB", 28.28, -15.41],
  ["Malabo", "GNQ", 8.78, 3.75],
  ["Malindi", "KEN", 40.1, -3.21, "Melinde"],
  ["Maputo", "MOZ", 32.59, -25.95, "Lourenço Marques"],
  ["Maseru", "LSO", 27.48, -29.32],
  ["Massawa", "ERI", 39.45, 15.61],
  ["Mbabane", "SWZ", 31.13, -26.32],
  ["Mogadishu", "SOM", 45.36, 2.07, "Muqdisho"],
  ["Mombasa", "KEN", 39.69, -4.04],
  ["Monrovia", "LBR", -10.8, 6.31],
  ["Moroni", "COM", 43.24, -11.7],
  ["N'Djamena", "TCD", 15.05, 12.12, "Fort-Lamy"],
  ["Nairobi", "KEN", 36.81, -1.28],
  ["Niamey", "NER", 2.11, 13.52],
  ["Nouakchott", "MRT", -15.98, 18.09],
  ["Ouagadougou", "BFA", -1.53, 12.37],
  ["Ouidah", "BEN", 2.09, 6.36, "Whydah"],
  ["Port Louis", "MUS", 57.5, -20.17, "Mauritius"],
  ["Porto-Novo", "BEN", 2.62, 6.48],
  ["Praia", "CPV", -23.52, 14.92, "Cape Verde Islands"],
  ["Pretoria", "ZAF", 28.23, -25.7],
  ["Saint-Louis, Senegal", "SEN", -16.51, 16.02],
  ["São Tomé", "STP", 6.73, 0.34],
  ["Timbuktu", "MLI", -3.02, 16.77, "Tombouctou"],
  ["Windhoek", "NAM", 17.08, -22.57],
  ["Yamoussoukro", "CIV", -5.28, 6.82],
  ["Yaoundé", "CMR", 11.51, 3.87],
  ["Zanzibar", "TZA", 39.2, -6.16, "Zanzibar City", "Stone Town"],
  // Central and South Asia
  ["Agra", "IND", 78.01, 27.17],
  ["Ahmedabad", "IND", 72.58, 23.03, "Sabarmati"],
  ["Almaty", "KAZ", 76.91, 43.33, "Alma-Ata"],
  ["Amritsar", "IND", 74.87, 31.64],
  ["Ashgabat", "TKM", 58.38, 37.95, "Ashkhabad"],
  ["Astana", "KAZ", 71.43, 51.18, "Nur-Sultan", "Akmola", "Tselinograd"],
  ["Baikonur", "KAZ", 63.24, 45.69, "Baykonur", "Leninsk", "Baikonur Cosmodrome"],
  ["Baku", "AZE", 49.86, 40.4],
  ["Balkh", "AFG", 66.9, 36.75, "Bactra"],
  ["Batumi", "GEO", 41.63, 41.6],
  ["Bishkek", "KGZ", 74.58, 42.88, "Frunze"],
  ["Bukhara", "UZB", 64.43, 39.78, "Buxoro"],
  ["Chennai", "IND", 80.28, 13.09, "Madras"],
  ["Colombo", "LKA", 79.86, 6.93],
  ["Delhi", "IND", 77.23, 28.67, "Old Delhi", "Shahjahanabad"],
  ["Dhaka", "BGD", 90.41, 23.73, "Dacca"],
  ["Dushanbe", "TJK", 68.77, 38.56, "Stalinabad"],
  ["Galle", "LKA", 80.24, 6.03],
  ["Herat", "AFG", 62.17, 34.33],
  ["Islamabad", "PAK", 73.08, 33.69],
  ["Kabul", "AFG", 69.18, 34.52],
  ["Kandahar", "AFG", 65.69, 31.61],
  ["Karachi", "PAK", 66.99, 24.87],
  ["Kathmandu", "NPL", 85.31, 27.72],
  ["Kochi", "IND", 76.22, 10.02, "Cochin"],
  ["Kolkata", "IND", 88.37, 22.57, "Calcutta"],
  ["Kozhikode", "IND", 75.77, 11.25, "Calicut"],
  ["Lahore", "PAK", 74.35, 31.56],
  ["Lucknow", "IND", 80.91, 26.86],
  ["Malé", "MDV", 73.51, 4.17],
  ["Mumbai", "IND", 72.88, 19.07, "Bombay"],
  ["New Delhi", "IND", 77.2, 28.6],
  ["Panaji", "IND", 73.82, 15.49, "Goa", "Old Goa", "Panjim"],
  ["Patna", "IND", 85.13, 25.63, "Pataliputra", "Patliputra"],
  ["Peshawar", "PAK", 71.53, 34.01],
  ["Puducherry", "IND", 79.83, 11.93, "Pondicherry"],
  ["Samarkand", "UZB", 66.94, 39.67, "Samarqand", "Maracanda"],
  ["Surat", "IND", 72.84, 21.2],
  ["Tashkent", "UZB", 69.27, 41.3],
  ["Tbilisi", "GEO", 44.79, 41.73, "Tiflis"],
  ["Thimphu", "BTN", 89.64, 27.47],
  ["Varanasi", "IND", 83, 25.33, "Benares", "Banaras"],
  ["Yerevan", "ARM", 44.51, 40.18],
  // East and Southeast Asia
  ["Ambon", "IDN", 128.2, -3.72, "Amboyna"],
  ["Ayutthaya", "THA", 100.57, 14.36, "Ayudhya"],
  ["Banda Aceh", "IDN", 95.32, 5.55, "Aceh"],
  ["Bandar Seri Begawan", "BRN", 114.93, 4.88],
  ["Bangkok", "THA", 100.51, 13.75],
  ["Beijing", "CHN", 116.39, 39.9, "Peking", "Peiping", "Khanbaliq", "Khanbalik", "Cambaluc", "Dadu"],
  ["Busan", "KOR", 129.01, 35.1, "Pusan"],
  ["Cebu", "PHL", 123.9, 10.32, "Cebu City"],
  ["Chengdu", "CHN", 104.07, 30.67],
  ["Chongqing", "CHN", 106.59, 29.57, "Chungking"],
  ["Dili", "TLS", 125.58, -8.56],
  ["Dunhuang", "CHN", 94.66, 40.14, "Shazhou"],
  ["Fukushima", "JPN", 140.47, 37.74],
  ["George Town", "MYS", 100.33, 5.41, "Penang", "Pinang"],
  ["Guangzhou", "CHN", 113.26, 23.12, "Canton"],
  ["Hangzhou", "CHN", 120.17, 30.25, "Hangchow", "Lin'an", "Kinsay", "Quinsai"],
  ["Hanoi", "VNM", 105.85, 21.04, "Thang Long"],
  ["Hiroshima", "JPN", 132.44, 34.39],
  ["Ho Chi Minh City", "VNM", 106.7, 10.76, "Saigon", "Sài Gòn"],
  ["Hong Kong", "HKG", 114.18, 22.31, "Victoria Harbour"],
  ["Hotan", "CHN", 79.93, 37.1, "Khotan"],
  ["Hue", "VNM", 107.58, 16.47],
  ["Incheon", "KOR", 126.64, 37.48, "Chemulpo"],
  ["Jakarta", "IDN", 106.83, -6.17, "Batavia", "Djakarta", "Jayakarta", "Sunda Kelapa"],
  ["Jiayuguan", "CHN", 98.3, 39.82, "Jiayu Pass"],
  ["Kaifeng", "CHN", 114.35, 34.79, "Bianjing"],
  ["Kashgar", "CHN", 75.97, 39.48, "Kashi", "Kaxgar"],
  ["Kuala Lumpur", "MYS", 101.69, 3.14],
  ["Kucha", "CHN", 82.94, 41.73, "Kuqa"],
  ["Kyoto", "JPN", 135.75, 35.03, "Heian-kyō", "Heiankyo"],
  ["Lanzhou", "CHN", 103.79, 36.06, "Lanchow"],
  ["Lhasa", "CHN", 91.1, 29.65],
  ["Luoyang", "CHN", 112.44, 34.64, "Loyang"],
  ["Macau", "MAC", 113.54, 22.19, "Macao"],
  ["Makassar", "IDN", 119.43, -5.14, "Macassar", "Ujung Pandang"],
  ["Malacca", "MYS", 102.25, 2.21, "Melaka", "Strait of Malacca"],
  ["Manila", "PHL", 120.98, 14.61, "Maynila"],
  ["Nagasaki", "JPN", 129.89, 32.76, "Dejima"],
  ["Naha", "JPN", 127.67, 26.21, "Okinawa", "Shuri"],
  ["Nanjing", "CHN", 118.78, 32.05, "Nanking"],
  ["Naypyidaw", "MMR", 96.12, 19.77, "Nay Pyi Taw", "Naypyitaw"],
  ["Osaka", "JPN", 135.5, 34.69],
  ["Palembang", "IDN", 104.75, -2.98, "Srivijaya"],
  ["Phnom Penh", "KHM", 104.91, 11.55],
  ["Pyongyang", "PRK", 125.75, 39.02],
  ["Quanzhou", "CHN", 118.58, 24.9, "Zayton", "Zaitun", "Zaiton"],
  ["Seoul", "KOR", 127, 37.57, "Hanseong", "Keijo"],
  ["Shanghai", "CHN", 121.43, 31.22],
  ["Shenyang", "CHN", 123.45, 41.81, "Mukden"],
  ["Singapore", "SGP", 103.85, 1.29, "Singapura", "Temasek"],
  ["Taipei", "TWN", 121.57, 25.04, "Taihoku"],
  ["Ternate", "IDN", 127.36, 0.79, "Moluccas", "Maluku Islands", "Spice Islands"],
  ["Tianjin", "CHN", 117.2, 39.08, "Tientsin"],
  ["Tidore", "IDN", 127.44, 0.7],
  ["Tokyo", "JPN", 139.75, 35.69, "Edo", "Yedo"],
  ["Turpan", "CHN", 89.17, 42.94, "Turfan"],
  ["Ulaanbaatar", "MNG", 106.91, 47.92, "Ulan Bator", "Urga"],
  ["Vientiane", "LAO", 102.6, 17.97],
  ["Wuhan", "CHN", 114.27, 30.58, "Hankou", "Hankow"],
  ["Xi'an", "CHN", 108.89, 34.28, "Chang'an", "Sian"],
  ["Xiamen", "CHN", 118.08, 24.45, "Amoy"],
  ["Xianyang", "CHN", 108.71, 34.35],
  ["Yangon", "MMR", 96.16, 16.79, "Rangoon"],
  ["Yarkand", "CHN", 77.25, 38.43, "Shache"],
  ["Yokohama", "JPN", 139.6, 35.43],
  // Oceania
  ["Auckland", "NZL", 174.76, -36.85],
  ["Brisbane", "AUS", 153.03, -27.45],
  ["Canberra", "AUS", 149.13, -35.28],
  ["Darwin", "AUS", 130.85, -12.43],
  ["Hagåtña", "GUM", 144.75, 13.47, "Agana", "Guam"],
  ["Hobart", "AUS", 147.3, -42.85, "Van Diemen's Land"],
  ["Honiara", "SLB", 159.95, -9.44],
  ["Melbourne", "AUS", 144.97, -37.82],
  ["Papeete", "PYF", -149.57, -17.53, "Tahiti"],
  ["Perth", "AUS", 115.84, -31.95, "Fremantle"],
  ["Port Moresby", "PNG", 147.19, -9.46],
  ["Suva", "FJI", 178.44, -18.13],
  ["Sydney", "AUS", 151.21, -33.87, "Port Jackson", "Botany Bay"],
  ["Tarawa", "KIR", 173.02, 1.34],
  ["Wellington", "NZL", 174.78, -41.29],
  // North America
  ["Acapulco", "MEX", -99.92, 16.85],
  ["Albany", "USA", -73.76, 42.65],
  ["Atlanta", "USA", -84.37, 33.74],
  ["Boston", "USA", -71.07, 42.33],
  ["Buffalo", "USA", -78.88, 42.88],
  ["Charleston", "USA", -79.99, 32.79, "Charles Town"],
  ["Chicago", "USA", -87.64, 41.85],
  ["Dawson City", "CAN", -139.42, 64.07, "Klondike"],
  ["Denver", "USA", -104.99, 39.74],
  ["Detroit", "USA", -83.05, 42.33],
  ["Halifax", "CAN", -63.6, 44.65],
  ["Hamilton", "BMU", -64.78, 32.29, "Bermuda"],
  ["Honolulu", "USA", -157.86, 21.3, "Oahu"],
  ["Houston", "USA", -95.35, 29.74],
  ["Independence", "USA", -94.42, 39.09],
  ["Los Angeles", "USA", -118.23, 34.05],
  ["Memphis, Tennessee", "USA", -90.03, 35.14],
  ["Mexico City", "MEX", -99.13, 19.44, "Tenochtitlan", "Ciudad de México"],
  ["Miami", "USA", -80.23, 25.79],
  ["Montgomery", "USA", -86.28, 32.36],
  ["Montreal", "CAN", -73.59, 45.5],
  ["New Orleans", "USA", -90.09, 29.97, "Nouvelle-Orléans"],
  ["New York", "USA", -74, 40.72, "New York City", "New Amsterdam", "Manhattan"],
  ["Nome", "USA", -165.41, 64.51],
  ["Nuuk", "GRL", -51.73, 64.2],
  ["Omaha", "USA", -96.01, 41.24],
  ["Ottawa", "CAN", -75.7, 45.42],
  ["Philadelphia", "USA", -75.18, 39.95],
  ["Portland", "USA", -122.68, 45.52],
  ["Quebec City", "CAN", -71.25, 46.84, "Québec"],
  ["Richmond", "USA", -77.45, 37.55],
  ["Sacramento", "USA", -121.47, 38.58],
  ["Saint Augustine", "USA", -81.31, 29.89],
  ["Saint Joseph", "USA", -94.85, 39.77],
  ["Saint Louis", "USA", -90.24, 38.64],
  ["Salt Lake City", "USA", -111.93, 40.78],
  ["San Antonio", "USA", -98.49, 29.42, "the Alamo"],
  ["San Francisco", "USA", -122.4, 37.78, "Yerba Buena"],
  ["Santa Fe", "USA", -105.94, 35.69],
  ["Savannah", "USA", -81.11, 32.02],
  ["Seattle", "USA", -122.32, 47.6],
  ["Selma", "USA", -87.02, 32.41],
  ["Skagway", "USA", -135.31, 59.46],
  ["St. John's", "CAN", -52.68, 47.58, "Newfoundland"],
  ["Toronto", "CAN", -79.39, 43.66, "York, Upper Canada"],
  ["Vancouver", "CAN", -123.12, 49.28],
  ["Veracruz", "MEX", -96.16, 19.18, "Vera Cruz"],
  ["Washington", "USA", -77.01, 38.9, "Washington, D.C.", "Washington DC"],
  // Central America and the Caribbean
  ["Belmopan", "BLZ", -88.77, 17.25],
  ["Bridgetown", "BRB", -59.62, 13.1],
  ["Cap-Haïtien", "HTI", -72.21, 19.76, "Cap-Français"],
  ["Colón", "PAN", -79.87, 9.37, "Aspinwall"],
  ["Guatemala City", "GTM", -90.53, 14.62, "Guatemala"],
  ["Havana", "CUB", -82.37, 23.13],
  ["Kingston", "JAM", -76.77, 17.98],
  ["Managua", "NIC", -86.27, 12.15],
  ["Nassau", "BHS", -77.35, 25.08],
  ["Panama City", "PAN", -79.53, 8.97, "Panama"],
  ["Port-au-Prince", "HTI", -72.34, 18.54],
  ["Port-of-Spain", "TTO", -61.52, 10.65],
  ["San José", "CRI", -84.08, 9.93],
  ["San Juan", "PRI", -66.13, 18.44, "Puerto Rico"],
  ["San Salvador, El Salvador", "SLV", -89.22, 13.7],
  ["Santiago de Cuba", "CUB", -75.82, 20.03],
  ["Santo Domingo", "DOM", -69.93, 18.47],
  ["Tegucigalpa", "HND", -87.22, 14.1],
  ["Willemstad", "CUW", -68.87, 12.11, "Curaçao"],
  // South America
  ["Asunción", "PRY", -57.63, -25.29],
  ["Belém", "BRA", -48.48, -1.45],
  ["Bogota", "COL", -74.09, 4.6, "Santa Fe de Bogotá"],
  ["Brasília", "BRA", -47.92, -15.78],
  ["Buenos Aires", "ARG", -58.43, -34.61],
  ["Callao", "PER", -77.13, -12.07],
  ["Caracas", "VEN", -66.92, 10.5],
  ["Cartagena", "COL", -75.52, 10.4, "Cartagena de Indias"],
  ["Cusco", "PER", -71.97, -13.53, "Cuzco", "Qosqo"],
  ["Georgetown", "GUY", -58.17, 6.8],
  ["Guayaquil", "ECU", -79.92, -2.22],
  ["La Paz", "BOL", -68.15, -16.5],
  ["Lima", "PER", -77.05, -12.05],
  ["Manaus", "BRA", -60, -3.1],
  ["Montevideo", "URY", -56.19, -34.91],
  ["Paramaribo", "SUR", -55.17, 5.84],
  ["Potosí", "BOL", -65.75, -19.57],
  ["Punta Arenas", "CHL", -70.94, -53.16],
  ["Quito", "ECU", -78.5, -0.21],
  ["Recife", "BRA", -34.91, -8.06, "Pernambuco"],
  ["Rio de Janeiro", "BRA", -43.21, -22.91, "Rio"],
  ["Salvador", "BRA", -38.48, -12.97, "Bahia", "São Salvador da Bahia"],
  ["Santiago", "CHL", -70.65, -33.44],
  ["São Paulo", "BRA", -46.63, -23.56],
  ["Stanley", "FLK", -57.85, -51.7, "Port Stanley", "Falklands", "Falkland Islands"],
  ["Sucre", "BOL", -65.26, -19.04],
  ["Ushuaia", "ARG", -68.31, -54.79, "Tierra del Fuego"],
  ["Valparaíso", "CHL", -71.62, -33.05],
  // Historic sites and small places Natural Earth leaves out, from Wikidata (CC0), with each item's ID.
  ["Aachen", "DEU", 6.08, 50.78, "Aix-la-Chapelle"], // Q1017
  ["Acre", "ISR", 35.08, 32.93, "Akko", "Akka", "Saint-Jean d'Acre", "Ptolemais"], // Q126084
  ["Amarna", "EGY", 30.91, 27.66, "Akhetaten", "Tell el-Amarna"], // Q5736
  ["Angkor", "KHM", 103.83, 13.43, "Angkor Wat", "Yasodharapura"], // Q163607
  ["Auschwitz", "POL", 19.18, 50.04, "Oświęcim"], // Q7341
  ["Austerlitz", "CZE", 16.88, 49.15, "Slavkov u Brna"], // Q193724
  ["Avignon", "FRA", 4.81, 43.95], // Q6397
  ["Babylon", "IRQ", 44.42, 32.54], // Q5684
  ["Bagan", "MMR", 94.86, 21.17, "Pagan"], // Q29317
  ["Bamiyan", "AFG", 67.82, 34.82, "Bamyan"], // Q214495
  ["Banda Islands", "IDN", 129.9, -4.52, "Banda", "Banda Neira", "Bandanaira"], // Q2882109
  ["Bethlehem", "PSE", 35.21, 31.7], // Q5776
  ["Bodh Gaya", "IND", 84.99, 24.7], // Q176767
  ["Byblos", "LBN", 35.65, 34.12, "Jbeil", "Gebal"], // Q173532
  ["Cannae", "ITA", 16.15, 41.3], // Q568611
  ["Cape Canaveral", "USA", -80.53, 28.46, "Cape Kennedy", "Kennedy Space Center"], // Q193401
  ["Cape Horn", "CHL", -67.29, -55.98, "Cabo de Hornos"], // Q4078
  ["Cape of Good Hope", "ZAF", 18.47, -34.36, "Cape of Storms"], // Q4092
  ["Cartagena, Spain", "ESP", -0.98, 37.6, "Carthago Nova", "New Carthage"], // Q162615
  ["Carthage", "TUN", 10.32, 36.85], // Q6343
  ["Chichen Itza", "MEX", -88.57, 20.68], // Q5859
  ["Ctesiphon", "IRQ", 44.58, 33.09], // Q192541
  ["Dandi", "IND", 72.81, 20.89], // Q1026197
  ["Delphi", "GRC", 22.5, 38.48], // Q75459
  ["Dien Bien Phu", "VNM", 103.03, 21.4], // Q136681034
  ["Dunkirk", "FRA", 2.38, 51.04, "Dunkerque"], // Q45797
  ["Easter Island", "CHL", -109.35, -27.12, "Rapa Nui", "Hanga Roa"], // Q14452
  ["El Alamein", "EGY", 28.95, 30.83, "Alamein"], // Q204439
  ["Elmina", "GHA", -1.35, 5.08, "São Jorge da Mina", "El Mina"], // Q968662
  ["Ephesus", "TUR", 27.34, 37.94], // Q47611
  ["Feodosia", "UKR", 35.38, 45.05, "Kaffa", "Caffa", "Theodosia", "Feodosiya"], // Q158491
  ["Galápagos Islands", "ECU", -90.55, -0.67, "Galapagos"], // Q38095
  ["Gallipoli", "TUR", 26.45, 40.35, "Gelibolu", "Gallipoli peninsula"], // Q192860
  ["Gettysburg", "USA", -77.23, 39.83], // Q694550
  ["Gorée", "SEN", -17.4, 14.67, "Île de Gorée"], // Q244347
  ["Great Zimbabwe", "ZWE", 30.93, -20.27], // Q209217
  ["Hampi", "IND", 76.46, 15.33, "Vijayanagara"], // Q26732
  ["Harappa", "PAK", 72.87, 30.63], // Q185562
  ["Hastings", "GBR", 0.58, 50.86], // Q29245
  ["Hattusa", "TUR", 34.62, 40.02, "Hattusas"], // Q181007
  ["Hedeby", "DEU", 9.57, 54.49, "Haithabu"], // Q165414
  ["Hormuz", "IRN", 56.46, 27.07, "Ormus", "Ormuz", "Hormoz", "Hormuz Island", "Strait of Hormuz"], // Q695265
  ["Iznik", "TUR", 29.72, 40.43, "Nicaea"], // Q217125
  ["Jamestown", "USA", -76.78, 37.21, "Jamestown, Virginia"], // Q323813
  ["Jericho", "PSE", 35.46, 31.86], // Q5687
  ["Kamakura", "JPN", 139.55, 35.32], // Q200267
  ["Karakorum", "MNG", 102.82, 47.2, "Qaraqorum", "Kharkhorin"], // Q62677
  ["Khiva", "UZB", 60.36, 41.38], // Q486195
  ["Kilwa Kisiwani", "TZA", 39.52, -8.98, "Kilwa"], // Q1741475
  ["Knossos", "GRC", 25.16, 35.3, "Cnossus"], // Q173527
  ["L'Anse aux Meadows", "CAN", -55.53, 51.6, "Vinland"], // Q189113
  ["La Gomera", "ESP", -17.11, 28.09, "San Sebastián de La Gomera", "Gomera"], // Q512009
  ["Lalibela", "ETH", 39.05, 12.04], // Q207590
  ["Leptis Magna", "LBY", 14.29, 32.64, "Lepcis Magna"], // Q191504
  ["Lindisfarne", "GBR", -1.8, 55.68, "Holy Island"], // Q213804
  ["Luang Prabang", "LAO", 102.13, 19.89], // Q190165
  ["Lumbini", "NPL", 83.28, 27.48], // Q9213
  ["Machu Picchu", "PER", -72.55, -13.16], // Q676203
  ["Mactan", "PHL", 123.97, 10.3, "Lapu-Lapu"], // Q685318
  ["Marathon", "GRC", 23.96, 38.15], // Q212150
  ["Memphis", "EGY", 31.25, 29.84], // Q5715
  ["Meroë", "SDN", 33.75, 16.94], // Q5780
  ["Merv", "TKM", 62.19, 37.66, "Marv"], // Q193325
  ["Mocha", "YEM", 43.25, 13.32, "Mokha", "Al Mukha"], // Q339258
  ["Mohenjo-daro", "PAK", 68.14, 27.33], // Q5725
  ["Mozambique Island", "MOZ", 40.73, -15.04, "Ilha de Moçambique", "Island of Mozambique"], // Q331099
  ["Mycenae", "GRC", 22.76, 37.73], // Q132564
  ["Nara", "JPN", 135.8, 34.69], // Q169134
  ["Nineveh", "IRQ", 43.15, 36.37], // Q5680
  ["Olympia", "GRC", 21.63, 37.64], // Q38888
  ["Ostia", "ITA", 12.29, 41.75, "Ostia Antica"], // Q1012797
  ["Palos de la Frontera", "ESP", -6.89, 37.23, "Palos"], // Q622030
  ["Pearl Harbor", "USA", -157.95, 21.36], // Q127091
  ["Pergamon", "TUR", 27.18, 39.13, "Pergamum"], // Q18986
  ["Persepolis", "IRN", 52.89, 29.94], // Q129072
  ["Petra", "JOR", 35.44, 30.33], // Q5788
  ["Plymouth, Massachusetts", "USA", -70.67, 41.96, "Plymouth Colony", "Plymouth Rock"], // Q326295
  ["Pompeii", "ITA", 14.49, 40.75], // Q43332
  ["Port Royal", "JAM", -76.84, 17.94], // Q685357
  ["Portobelo", "PAN", -79.65, 9.55, "Porto Bello", "Portobello"], // Q797147
  ["Ruijin", "CHN", 116.03, 25.88], // Q1025459
  ["Saint Helena", "SHN", -5.72, -15.93, "Jamestown, Saint Helena"], // Q30970
  ["San Salvador", "BHS", -74.5, 24.04, "Guanahani", "San Salvador Island", "Watling Island", "Watling's Island"], // Q845540
  ["Sanlúcar de Barrameda", "ESP", -6.35, 36.78, "Sanlúcar"], // Q210887
  ["Sijilmasa", "MAR", -4.28, 31.28], // Q1334331
  ["Sofala", "MOZ", 34.72, -20.15], // Q1361151
  ["Strait of Magellan", "CHL", -71, -54, "Magellan Strait"], // Q48365
  ["Susa", "IRN", 48.26, 32.19, "Shush"], // Q180773
  ["Taxila", "PAK", 72.79, 33.75], // Q156093
  ["Teotihuacan", "MEX", -98.84, 19.69], // Q172613
  ["Thermopylae", "GRC", 22.54, 38.8], // Q194450
  ["Tikal", "GTM", -89.62, 17.22], // Q181172
  ["Tobruk", "LBY", 23.95, 32.08], // Q182092
  ["Troy", "TUR", 26.24, 39.96, "Ilium", "Ilion"], // Q22647
  ["Tyre", "LBN", 35.2, 33.27, "Sour"], // Q82070
  ["Ur", "IRQ", 46.1, 30.96, "Ur of the Chaldees"], // Q5699
  ["Uruk", "IRQ", 45.64, 31.33, "Warka", "Erech"], // Q168518
  ["Verdun", "FRA", 5.38, 49.16], // Q154748
  ["Waterloo", "BEL", 4.38, 50.72], // Q179034
  ["Wittenberg", "DEU", 12.65, 51.87, "Lutherstadt Wittenberg"], // Q6837
  ["Xanadu", "CHN", 116.19, 42.36, "Shangdu"], // Q471765
  ["Yan'an", "CHN", 109.49, 36.6, "Yenan"], // Q515388
  ["Yorktown", "USA", -76.51, 37.23], // Q938699
];

// Lowercase, without accents and punctuation, so "Chang'an", "changan" and "CHANG'AN" are one name, and so are
// "Saint-Louis", "St. Louis" and "Saint Louis".
const LETTERS: Record<string, string> = { ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i" };
function key(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øæœßłđðþı]/g, (letter) => LETTERS[letter])
    .replace(/['’‘`ʻʼ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "")
    .replace(/^st /, "saint ");
}

const byName = new Map<string, Place>();
for (const [name, country, lon, lat, ...otherNames] of PLACES) {
  const place = { name, lon, lat, country };
  for (const each of [name, ...otherNames]) byName.set(key(each), place);
}

// The place a name stands for, or null when the table does not know it. A name with a note, like "Calicut, India",
// "Kaffa (Crimea)" or "Chang'an (Xi'an)", is tried whole, then part by part. "New York City" and "the port of Aden"
// find New York and Aden.
export function placeOf(name: string): Place | null {
  const plain = name.replace(/^\s*(the )?(city|port|town) of /i, "").replace(/\s+city\s*$/i, "");
  for (const each of [name, plain]) {
    const place = byName.get(key(each));
    if (place) return { ...place };
  }
  // "Calicut, India", "Kaffa (Crimea)" or "Chang'an (Xi'an)": a part names the place when every other part agrees
  // with it, as another name of the same place, its country or a region of its country. "Paris, Texas" is not Paris.
  const parts = name.split(/[(),]/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const place = byName.get(key(part));
    if (!place) continue;
    const others = parts.filter((other) => other !== part);
    const agrees = (other: string) =>
      byName.get(key(other)) === place || namesCountry(other, place.country) || namesRegionOf(other, place.country);
    if (others.every(agrees)) return { ...place };
  }
  return null;
}
