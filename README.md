# Mieszkanie czy obligacje?

Prosty kalkulator w języku polskim porównujący rentowność mieszkania z uproszczoną inwestycją w obligacje. Działa bez serwera obliczeniowego i bez instalowania zależności.

## Domyślne dane

- Zakup: 30.10.2013, koszt ze wszystkimi opłatami 300 000 zł.
- Wycena: bieżąca data lokalna przeglądarki, wartość 750 000 zł.
- Najem bez kredytu: 2 000 zł miesięcznie netto po kosztach i podatkach.
- Obligacje: 6% rocznie brutto, kapitalizacja roczna, 19% podatku od zysku na końcu.

Wszystkie dane można zmieniać. Miesięczny, roczny i łączny dochód z najmu są powiązane. Po zmianie dat zachowana jest ostatnia kwota podana przez użytkownika.

## Obliczenia

XIRR uwzględnia koszt zakupu jako ujemny przepływ, najem jako miesięczne wpływy oraz wartość mieszkania jako końcowy wpływ. Daty są liczone w UTC, a rok dla XIRR ma 365 dni. Wycenę traktujemy jako hipotetyczną sprzedaż, bez dodatkowych kosztów lub podatku od sprzedaży. Wynik jest nominalny, bez korekty o inflację.

Pełne miesiące najmu kończą się w miesięczną rocznicę zakupu, z ograniczeniem dnia do końca miesiąca. Niepełny ostatni miesiąc jest proporcją dni między rocznicami. Najem nie jest reinwestowany. Po wpisaniu sumy przyjmujemy równomierny rozkład miesięczny; bez historii faktycznych wpływów XIRR jest oszacowaniem.

Obligacje to model stałej stopy, nie odtworzenie konkretnej emisji ani historycznych ofert. Dla `t = liczba dni / 365`, kapitału `P` i stopy brutto `r`:

```text
odsetki brutto = P × ((1 + r)^t − 1)
podatek = odsetki brutto × 19%
wartość końcowa netto = P + odsetki brutto × 81%
roczna stopa netto = (wartość końcowa netto / P)^(1/t) − 1
```

Niepełny rok jest liczony potęgowo. Podatek naliczamy tylko na końcu. Pomijamy opłaty za przedterminowy wykup i wykupy/reinwestycje poszczególnych emisji.

Różnica w złotych to: wartość mieszkania + łączny najem − wartość obligacji po podatku. Kalkulator pokazuje przewagę dowolnej inwestycji, zależnie od danych.

## Weryfikacja

Testy (Node.js 22 lub nowszy):

```sh
node --test tests/*.test.mjs
```

Obejmują przykład XIRR Microsoftu, ujemną i zerową rentowność, kapitalizację i podatek, luty i niepełne miesiące, trzy sposoby podania najmu, walidację oraz polskie formaty kwot.

Dla daty wyceny 13.09.2026 i pozostałych wartości domyślnych:

| Wynik | Kwota / stopa |
| --- | ---: |
| Łączny najem netto | 308 903,23 zł |
| Łączny zysk z mieszkania | 758 903,23 zł |
| XIRR mieszkania | 13,428486% |
| Odsetki obligacji brutto | 335 399,59 zł |
| Podatek od obligacji | 63 725,92 zł |
| Zysk z obligacji netto | 271 673,67 zł |
| Roczna stopa obligacji netto | 5,133748% |
| Przewaga mieszkania w zysku | 487 229,55 zł |

## Uruchomienie i publikacja

Udostępnij katalog dowolnym statycznym serwerem HTTP. Główny plik to `index.html`. Nie jest potrzebny proces budowania.

W GitHub Pages wybierz **Deploy from a branch**, gałąź **main**, katalog **/(root)**. Plik `.nojekyll` wyłącza przetwarzanie Jekyll. Wszystkie odwołania do lokalnych plików są względne i działają w podkatalogu repozytorium.

Strona nie zapisuje ani nie przesyła wprowadzonych kwot; stan resetuje się po odświeżeniu. Kroje pisma są pobierane z Google Fonts, z lokalnym krojem zastępczym. Wspierane przeglądarki mogą korzystać z opcjonalnych narzędzi WebMCP do odczytu i zmiany tych samych danych.

## Źródła

- [Microsoft: XIRR](https://support.microsoft.com/en-us/excel/functions/xirr-function).
- [Obligacje Skarbowe: opodatkowanie dochodów osób fizycznych](https://www.obligacjeskarbowe.pl/media_files/9b18d248-c989-4cd2-a11f-c29a40134973.pdf).
