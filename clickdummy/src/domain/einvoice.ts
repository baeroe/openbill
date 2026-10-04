import type { TemplateContext } from './templateContext'

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const amount = (v: unknown) => Number(v ?? 0).toFixed(2)
const date102 = (iso: unknown) => String(iso ?? '').replace(/-/g, '')

const party = (tag: string, p: Record<string, unknown> | null) => p ? `
      <ram:${tag}>
        <ram:Name>${esc(p.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(p.zip)}</ram:PostcodeCode>
          <ram:LineOne>${esc(p.street)}</ram:LineOne>
          <ram:CityName>${esc(p.city)}</ram:CityName>
          <ram:CountryID>${esc(p.country)}</ram:CountryID>
        </ram:PostalTradeAddress>${p.vat_id ? `
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:${tag}>` : ''

/** Vereinfachte ZUGFeRD/CII-Struktur zur Anschauung im Klickdummy — nicht validiert. */
export function generateCiiXml(ctx: TemplateContext): string {
  const d = ctx.document
  const notes = (d.legal_notes as string[]) ?? []
  const lines = ctx.positions.filter((p) => p.is_item).map((p) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${esc(p.index)}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(p.title)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amount(p.unit_price)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${esc(p.unit_code)}">${esc(p.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:RateApplicablePercent>${esc(p.tax_percent)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(p.total)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('')
  const taxes = ((d.tax_breakdown as Record<string, unknown>[]) ?? []).map((t) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amount(t.tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${notes.length && t.percent === 0 ? `
        <ram:ExemptionReason>${esc(notes[0])}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${amount(t.net)}</ram:BasisAmount>
        <ram:CategoryCode>${esc(t.category)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${esc(t.percent)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(d.number)}</ram:ID>
    <ram:TypeCode>${d.type === 'cancellation' ? '381' : '380'}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${date102(d.date)}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lines}
    <ram:ApplicableHeaderTradeAgreement>${party('SellerTradeParty', ctx.org)}${party('BuyerTradeParty', ctx.customer)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${date102(d.service_date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${taxes}
      <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${date102(d.due_date)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amount(d.net_total)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amount(d.net_total)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${amount(d.tax_total)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amount(d.gross_total)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amount(d.gross_total)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
