<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    Building2,
    Banknote,
    Mail,
    Server,
    ChevronRight,
    FileText,
    Image as ImageIcon,
    Hash
  } from '@lucide/svelte'
  import type { Component } from 'svelte'

  type Tab = 'company' | 'mail' | 'smtp'
  let activeTab = $state<Tab>('company')

  type CardLink = { title: string; desc: string; href: string; icon: Component }

  const companyCards: CardLink[] = [
    {
      title: 'Firmendaten',
      desc: 'Firmenname, Anschrift, Kontaktdaten und Anrede.',
      href: '/settings/company',
      icon: Building2
    },
    {
      title: 'Bank & Steuer',
      desc: 'IBAN, BIC, USt-IdNr. und Steuernummer.',
      href: '/settings/bank',
      icon: Banknote
    },
    {
      title: 'Erscheinungsbild',
      desc: 'Logo, Briefkopf und PDF-Footer.',
      href: '/settings/branding',
      icon: ImageIcon
    },
    {
      title: 'Nummernkreise',
      desc: 'Format und nächste Werte für Rechnungen, Angebote, Kunden.',
      href: '/settings/numbering',
      icon: Hash
    }
  ]

  const mailCards: CardLink[] = [
    {
      title: 'Mailvorlagen',
      desc: 'Betreff und Body für Rechnung, Mahnung, Angebot, Lohnzettel.',
      href: '/settings/mail-templates',
      icon: FileText
    },
    {
      title: 'Standardabsender',
      desc: 'Anrede-Stil und Default-Texte für alle Module.',
      href: '/settings/mail-defaults',
      icon: Mail
    }
  ]

  const smtpCards: CardLink[] = [
    {
      title: 'SMTP-Server',
      desc: 'Host, Port, Verschlüsselung und Anmeldedaten.',
      href: '/settings/smtp',
      icon: Server
    },
    {
      title: 'Test-Versand',
      desc: 'Einmalig eine Test-Mail an Ihre Adresse senden.',
      href: '/settings/smtp/test',
      icon: Mail
    }
  ]

  const cardsForTab = $derived(
    activeTab === 'company'
      ? companyCards
      : activeTab === 'mail'
        ? mailCards
        : smtpCards
  )
</script>

<PageHeader title="Einstellungen" />

<div role="tablist" class="tabs tabs-lift mb-4">
  <button
    role="tab"
    type="button"
    class="tab"
    class:tab-active={activeTab === 'company'}
    onclick={() => (activeTab = 'company')}
  >
    <Building2 size={16} class="me-2" /> Firmendaten und Steuer
  </button>
  <button
    role="tab"
    type="button"
    class="tab"
    class:tab-active={activeTab === 'mail'}
    onclick={() => (activeTab = 'mail')}
  >
    <Mail size={16} class="me-2" /> E-Mail
  </button>
  <button
    role="tab"
    type="button"
    class="tab"
    class:tab-active={activeTab === 'smtp'}
    onclick={() => (activeTab = 'smtp')}
  >
    <Server size={16} class="me-2" /> SMTP
  </button>
</div>

<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {#each cardsForTab as card (card.href)}
    {@const Icon = card.icon}
    <a
      href={card.href}
      class="card border-base-300 bg-base-100 hover:border-primary border transition hover:shadow-md"
    >
      <div class="card-body gap-3">
        <div class="flex items-start justify-between">
          <div class="bg-primary/10 text-primary rounded-lg p-2">
            <Icon size={20} />
          </div>
          <ChevronRight size={18} class="text-base-content/30" />
        </div>
        <h3 class="card-title text-base">{card.title}</h3>
        <p class="text-base-content/60 text-sm">{card.desc}</p>
      </div>
    </a>
  {/each}
</div>
