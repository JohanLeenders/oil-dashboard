# Oranjehoen Intelligence Layer (OIL)
## Canon Kostprijsmodel – Two‑Pager

**Status:** Definitief (vervangt eerdere canon)

---

## 1. Doel en uitgangspunt

Dit document beschrijft het **canonieke kostprijsmodel** van het Oranjehoen Intelligence Layer (OIL). Het doel van dit model is **niet** boekhoudkundige rapportage, maar **economisch correcte, reproduceerbare en verklaarbare kostprijzen** per product, gebaseerd op biologie, proces en waardeverdeling.

Het model is gevalideerd met **Validatiegolf 1 (batch 22‑09)** en vormt vanaf nu de **enige waarheid** voor verdere ontwikkeling van OIL.

Belangrijk uitgangspunt:
> *Tot het uitsnijden is een kip economisch één geheel. Waarde ontstaat pas bij de splitsing.*

---

## 2. Kernprincipes van het model

### 2.1 Joint costs

**Joint costs** zijn kosten die biologisch onlosmakelijk zijn tot het moment van split‑off.

Deze bestaan uitsluitend uit:
- Levend inkopen (€/kg levend)
- Slachtkosten (€/kip)

Deze kosten worden **nooit fysiek** (op gewicht) verdeeld, maar uitsluitend op basis van **waarde**.

---

### 2.2 Joint products (harde scope)

Alleen de volgende producten worden beschouwd als **joint products**:
- Borstkap
- Bouten
- Vleugels

Uitsluitend deze drie producten nemen deel aan de verdeling van joint costs.

➡️ Dit is **hard afgedwongen**: geen enkel ander product mag joint cost dragen.

---

### 2.3 By‑products (Route A – definitief)

Alle overige stromen zijn **by‑products** (reststromen):
- Rest uit borstkap
- Rest uit bouten
- Overige griller
- Afval‑ en nevenstromen

Eigenschappen van by‑products:
- Dragen **geen** joint cost
- Hebben een vaste opbrengst (€0,20/kg)
- Worden verwerkt **vóór** kostentoerekening

Formule:
```
C_netto_joint = C_joint − opbrengst_by_products
```

Daarna pas wordt SVASO toegepast.

➡️ Dit voorkomt dat hoogwaardige producten hun eigen afval subsidiëren.

---

## 3. Waardeverdeling: SVASO en mini‑SVASO

### 3.1 SVASO (Sales Value at Split‑Off)

De **Sales Value at Split‑Off methode** verdeelt `C_netto_joint` over de drie joint products:
- Borstkap
- Bouten
- Vleugels

Verdeling gebeurt op basis van **shadow prices**:
- Afgeleid uit downstream opbrengsten en yields
- Geen marktprijzen
- Geen fysieke (gewicht) allocatie

Het resultaat:
- Elk joint product draagt een eerlijk aandeel van de gezamenlijke kosten
- Marges zijn onderling vergelijkbaar

---

### 3.2 Mini‑SVASO (sub‑joint verdeling)

Binnen sommige joint products vindt een **sub‑verdeling** plaats:

**Borstkap → Filet**
- 100% van de kosten naar filet
- Rest is kostloos (al gecrediteerd)

**Bouten → Dijfilet & Drumvlees**
- Kostenverdeling op basis van relatieve waarde
- Alleen hoofdproducten
- Geen reststromen

➡️ Dit is géén herverdeling van joint costs, maar een logische verdeling binnen één joint product.

---

## 4. ABC‑kosten (Activity Based Costing)

Na split‑off worden **ABC‑kosten** toegevoegd:
- Snijden
- Vacumeren
- Verpakken
- Overige bewerkingen

Eigenschappen:
- Altijd **additief**
- Per eindproduct (SKU)
- **Herverdelen nooit** joint costs

➡️ ABC verklaart **proceskosten**, niet de waarde van de kip.

---

## 5. NRV: beslissingslaag, geen kostprijslaag

**Net Realizable Value (NRV)** wordt gebruikt om beslissingen te ondersteunen:

```
NRV = verkoopprijs − downstream kosten
```

Belangrijk:
- NRV is een **simulatie‑ en beslissingslaag**
- NRV **mag nooit** alloceren
- NRV **mag nooit** kostprijzen aanpassen

Waarom?
- Verkoopprijzen zijn vluchtig
- Kostprijzen moeten stabiel en reproduceerbaar blijven

➡️ NRV ondersteunt keuzes (verkopen, invriezen, verwerken), maar verandert de waarheid niet.

---

## 6. Rekenlagen (waterval‑model)

Het OIL‑model bestaat uit expliciete rekenlagen:

0. Input & biologie
1. Joint cost pool
2. By‑product credit
3. SVASO allocatie
4. Mini‑SVASO
5. ABC‑kosten
6. Full cost per SKU
7. NRV (read‑only)

➡️ De **echte kostprijs** bevindt zich op **Level 6**.

---

## 7. Waarom dit een goed kostprijsmodel is

Dit model is:
- **Biologisch correct** (respecteert onlosmakelijkheid)
- **Economisch zuiver** (waarde‑gedreven)
- **Deterministisch & reproduceerbaar**
- **Explainable** (herleidbaar per laag)
- **Audit‑proof**

Het model dwingt discipline af en voorkomt:
- scope‑lekken
- politieke kostprijsdiscussies
- Excel‑logica per persoon

---

## 8. Slot

Dit canonieke kostprijsmodel vormt het fundament van het Oranjehoen Intelligence Layer.

Alle verdere ontwikkeling (UI, dashboards, beslissingslogica) **moet hierop aansluiten** en mag dit model **niet aanpassen**.

**Afwijken = expliciet breken met de canon.**

