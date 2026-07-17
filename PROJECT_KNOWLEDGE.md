# PROJECT KNOWLEDGE

**Project Codename:** Project Atelier

**Customer Brand:** بيتي بذوقي

**Document Version:** 1.1

**Status:** Discovery Completed; planning amendments recorded 2026-07-16

---

# Purpose

This document is the complete knowledge base of Project Atelier.

It captures all validated business knowledge, product decisions, design philosophy, workflows, constraints, and future vision gathered during the discovery phase.

It is intentionally implementation-agnostic. It does not describe how the system should be built, only what the product is, how it should behave, and why certain decisions were made.

---

# Single Source of Truth

This document is the authoritative source of knowledge for the project.

All future project documentation must be derived from this file, including but not limited to:

- Master PRD
- Technical Specifications
- Database Design
- API Design
- UI/UX Documentation
- Design System
- Development Roadmap
- Task Breakdown
- AI Agent Instructions
- Testing Documentation

If any future document contradicts this file, **PROJECT_KNOWLEDGE.md takes precedence** until the product owner explicitly approves a new decision.

## Approved Planning Amendments

The explicit planning instructions recorded in `MASTER_PRD.md` refine release phases without removing capabilities from the long-term product:

- Version 1 is the complete core transaction defined in `MASTER_PRD.md` Section 5.
- AI, advanced analytics, push notifications, Reviews, Favorites, and Saved Designs are proposed for Version 1.1 rather than Version 1.
- 360° media is deferred to Version 1.1 because the required production asset workflow is not documented; basic images, gallery, and zoom remain Version 1.
- Advanced comparison is proposed for Version 1.2 or later.
- `DECISION_WORKSHOP.md` is the canonical Accepted/partial decision register. The strict review found no true remaining Architecture Blocker; Business Policy (`BP-*`), Configuration (`CFG-*`), and Implementation Detail (`IMP-*`) items remain tracked at their appropriate gates. Recommendations are not approved beyond Product Owner choices.

### Product Owner Decisions — 2026-07-16

`DECISION_FORM.md` is authoritative for `DW-001` through `DW-014`. The following decisions supersede conflicting older statements below:

- An Order is created when the Customer accepts the current quotation; production still requires manual Payment Verification.
- Submitted content locks; sent quotation revisions are numbered and immutable; only the current revision may be accepted; changes and declines are recorded.
- Default currency is configurable SAR; prices use a detailed breakdown and configurable taxes; Version 1 requires full bank transfer; deposits are future scope.
- Payment proof accepts JPG, PNG, and PDF; every submission remains in history; verification is manual; nothing is deleted automatically.
- Cancellation and after-sales policy is Manager-defined, configurable, and based on Saudi regulations; its substantive terms remain open and must not be assumed.
- Production is Not Started → Materials Preparation → In Production → Quality Inspection → Ready; failed inspection returns to In Production.
- Version 1 production is tracked at the Order level. Order Items remain first-class immutable domain objects but have no independent production lifecycle; future item-level tracking must be additive and preserve historical data.
- Delivery is default and pickup optional; delivery price and address are confirmed before acceptance; handoff proof is required.
- Customers use email + OTP; the Manager uses a strong password, MFA, and recovery codes.
- Data classes are Public (Products/Portfolio), Private (Customers/Orders), Sensitive (Payment proof), and Restricted (Internal notes/Audit logs); everything is private by default.
- One continuous conversation links to the Project/Order. Email + in-app notifications cover Quote Ready, Quote Accepted, Payment Received, Payment Verified, Production Started, Ready, and Delivered. WhatsApp is later scope.
- Arabic is required, English optional, and French outside Version 1. Human approval is required for translations.
- The current Version 1 targets in `QUALITY_GATES.md` are Accepted, subject to the more specific language decision above.
- The design system follows an accessible warm-neutral, paired-type, consistent, restrained-motion, RTL-first direction reflecting premium Saudi interior brands.
- The recommended baseline-derived outcome measures are Accepted with average quotation preparation time, Customer satisfaction, on-time delivery rate, Order completion rate, and production delay rate added.

Where an older section below conflicts with these amendments, the Product Owner decisions above and the current `MASTER_PRD.md` control. Original long-term feature intent remains unless explicitly re-phased or removed from Version 1.

---

# Scope

This document contains only validated knowledge that has been discussed and agreed upon during product discovery.

It does **not** contain:

- Source code
- Technical implementation details
- Framework-specific decisions
- Database schemas
- API endpoints
- UI mockups

Those documents will be generated later from the knowledge contained here.

---

# Objective

The primary objective of this document is to transfer complete project understanding to both human developers and AI coding agents.

Any AI agent reading this file should understand the business, product vision, workflows, constraints, philosophy, and goals before producing implementation or technical documentation.

This document exists to minimize assumptions, preserve product intent, and ensure that future implementation remains aligned with the original vision of the project.

---

# 1. Business

## Business Overview

**بيتي بذوقي** is a custom furniture workshop that designs and manufactures furniture based on customer orders rather than maintaining ready-made inventory.

The platform is built around a made-to-order business model where every order represents a production project between the customer and the workshop.

The objective is to digitize the entire customer journey, from product discovery and customization to quotation approval, payment, production tracking, and final delivery or pickup.

---

## Business Type

- Custom furniture workshop.
- Made-to-order manufacturing.
- Direct-to-customer business.
- Single workshop in Version 1.

---

## Business Model

The workshop does not operate as a traditional e-commerce store with stocked inventory.

Instead, products act as customizable templates that customers can either purchase exactly as displayed or personalize according to their preferences.

Furniture is manufactured only after:

1. The customer submits a request.
2. The manager reviews the request.
3. Both parties agree on the quotation and production details.
4. The customer completes payment by bank transfer.
5. The manager verifies the payment.

Only then does production begin.

---

## Version 1 Scope

The first version is intentionally simple and focuses on digitizing one real furniture business.

Version 1 includes:

- One furniture workshop.
- One manager account.
- Customer accounts.
- No worker accounts.
- No inventory management.
- No supplier management.
- No multi-store support.

The architecture should allow these capabilities to be added in future versions without requiring a major redesign.

---

## Target Market

The business serves customers looking for custom furniture across multiple price ranges.

The platform should support products ranging from affordable everyday furniture to premium handcrafted pieces without changing the overall customer experience.

---

## Pricing Strategy

At this stage, furniture prices are not finalized.

For demonstrations, development, and testing purposes, products may use realistic sample prices approximately between **400 MAD and 1,000 MAD** for individual furniture items.

These values are placeholders only.

Final pricing is determined entirely by the manager through the administration system and should never be hardcoded into the application.

Future pricing may depend on factors such as:

- Product type.
- Dimensions.
- Materials.
- Fabrics.
- Customization options.
- Delivery requirements.
- Additional services.

The platform architecture should be designed to support flexible pricing rules in future versions.

---

# 2. Brand

## Brand Identity

### Customer Brand

**بيتي بذوقي**

The brand represents the idea that every home should reflect the owner's personality, taste, and lifestyle. Rather than selling furniture as products, the brand aims to help customers create spaces that feel uniquely their own.

---

### Internal Development Name

**Project Atelier**

"Project Atelier" is used only for internal development, documentation, and communication between developers and AI agents. It is never exposed to customers.

---

## Brand Personality

The brand should be perceived as:

- Premium
- Elegant
- Modern
- Warm
- Trustworthy
- Personal
- Professional
- Timeless
- High-quality
- Customer-focused

The experience should communicate craftsmanship, attention to detail, and confidence without appearing overly luxurious or intimidating.

---

## Brand Experience

Customers should feel that they are working directly with skilled craftsmen rather than shopping from a generic online furniture store.

The platform should create a sense of collaboration, where every order feels like a personalized project instead of a standard purchase.

Every interaction should reinforce quality, transparency, and trust throughout the customer journey.

---

## Visual Identity

The overall visual identity should reflect a premium furniture showroom.

Key characteristics include:

- Clean and minimal layouts.
- High-quality photography.
- Elegant typography.
- Soft, warm color palette.
- Spacious layouts with generous whitespace.
- Smooth and purposeful animations.
- Consistent visual hierarchy.

The design should avoid looking like a typical e-commerce marketplace and instead resemble a luxury interior design studio.

---

## Emotional Goal

When a customer visits **بيتي بذوقي**, they should immediately feel:

> "This is where I can create furniture made specifically for my home."

The brand experience should inspire confidence, creativity, and excitement while maintaining simplicity and professionalism.

---

# 4. Core Philosophy

## Philosophy Overview

The philosophy of **بيتي بذوقي** defines the fundamental principles that guide every business decision, design choice, user interaction, and future feature.

Whenever there is uncertainty during product development, these principles should take precedence over implementation preferences.

The platform should remain consistent with this philosophy throughout its entire lifecycle.

---

## Luxury Before Complexity

Luxury is achieved through simplicity, clarity, quality, and attention to detail—not by adding unnecessary features.

Every screen, workflow, and interaction should feel elegant, intuitive, and refined.

---

## Visual Before Textual

Customers should understand products through visuals before reading descriptions.

Whenever possible, use:

- High-quality images
- 360° product views
- Visual option selectors
- Interactive previews
- Icons and illustrations

instead of relying on long blocks of text.

---

## Arabic First

Arabic is the primary language of the platform.

Every feature, page, and component must be designed with RTL support from the beginning.

French and English are complete translations rather than separate experiences.

---

## Mobile First

The majority of customers are expected to use mobile devices.

The platform should therefore be designed for mobile first, then enhanced for larger screens.

Desktop should extend the experience, not define it.

---

## Manager Controls the Business

Business rules should be configurable whenever possible.

The manager should control products, options, pricing, content, homepage sections, and business settings through the CMS without modifying the application's source code.

---

## AI Assists, Humans Decide

Artificial Intelligence exists to improve the customer experience by providing recommendations, search assistance, translations, and inspiration.

Final business decisions always belong to humans.

AI must never approve quotations, payments, production, or other critical business operations.

---

## Performance Is a Feature

A premium experience must also be a fast experience.

Fast loading, responsive interactions, optimized media, and smooth navigation are considered core product features rather than optional improvements.

---

## Accessibility Is Mandatory

The platform should be usable by as many people as possible.

Accessibility should be considered from the beginning rather than added later.

---

## Everything Should Feel Premium

Every interaction should communicate quality and craftsmanship.

From browsing products to receiving order updates, customers should feel that they are working with a professional furniture atelier rather than a generic online store.

Premium should be reflected not only in visual design but also in usability, communication, trust, and overall customer experience.

---

# 5. Languages

## Localization Strategy

The platform is designed to support multiple languages while providing a consistent user experience across all regions.

Localization is considered a core feature rather than an afterthought, allowing the business to reach a wider audience without maintaining multiple versions of the platform.

---

## Supported Languages

### Primary Language

**Arabic (RTL)**

Arabic is the default language of the platform and the primary language used by both the business and most customers.

The entire application should be designed with RTL support from the beginning.

---

### Secondary Languages

- French
- English

These languages provide accessibility for customers who are more comfortable using French or English while maintaining the same functionality as the Arabic version.

---

## Content Management

The manager primarily creates and manages content in Arabic.

To reduce workload, AI may generate French and English translations for products, collections, pages, and other content.

However, all AI-generated translations should be reviewed and approved by the manager before publication to ensure accuracy and maintain the brand's tone of voice.

---

## Localization Principles

The platform should support localization across the entire user experience, including:

- User interface
- Products
- Collections
- Categories
- CMS content
- Notifications
- Emails
- Validation messages
- Error messages
- Policies
- Customer communication

No customer-facing text should be hardcoded into the application.

---

## Future Considerations

The localization system should be flexible enough to support additional languages in future versions without requiring major architectural changes.

---

# 6. Users

## User Roles

The platform is designed around three primary user roles. Each role has a specific purpose and set of responsibilities within the system.

The first version intentionally keeps the user structure simple to match the real business workflow.

---

## Visitor

A visitor is anyone accessing the platform without creating an account.

Visitors can:

- Browse the homepage.
- Explore collections.
- Browse products.
- View product details.
- View inspiration and completed projects.
- Search the catalog.
- Read company information.
- Switch between supported languages.

Visitors cannot:

- Save products.
- Customize furniture.
- Submit project requests.
- Contact the manager through the internal messaging system.
- Leave reviews.
- Track orders.

Visitors are encouraged to create an account before starting a furniture project.

---

## Customer

A customer is a registered user interested in ordering custom furniture.

Customers can:

- Manage their personal account.
- Browse the product catalog.
- Order products exactly as displayed.
- Customize products using the Design Studio.
- Create project requests containing multiple furniture items.
- Save favorite products.
- Save custom designs.
- Chat with the manager.
- Receive notifications.
- Upload payment proof.
- Track production progress.
- Leave reviews after completed orders.

Customers represent the primary users of the platform.

---

## Manager

The manager is responsible for operating and controlling the entire business through the platform.

The manager can:

- Manage products.
- Manage collections.
- Manage categories.
- Manage materials.
- Manage colors.
- Configure product customization options.
- Upload images and product media.
- Manage homepage content.
- Review project requests.
- Create quotations.
- Verify payments.
- Update production progress.
- Manage deliveries.
- Communicate with customers.
- Manage translations.
- Moderate reviews.
- View business analytics.
- Configure business settings through the CMS.

The manager has complete administrative control over Version 1 of the platform.

---

## Worker Accounts

Version 1 does **not** include worker accounts.

The workshop's internal production process remains outside the platform.

Once a customer order is approved and payment is verified, the manager coordinates production with the workshop manually.

The system should be architected so worker accounts can be introduced in future versions without requiring major changes to the overall architecture.

---

# 7. Customer Journey

## Overview

The customer journey is designed to be simple, transparent, and collaborative.

Unlike a traditional e-commerce platform, customers do not immediately purchase furniture. Instead, they work together with the manager to finalize a custom furniture project before production begins.

The entire journey should minimize uncertainty while providing customers with confidence throughout every stage.

---

## Step 1 — Discover

The customer visits the platform and explores:

- Homepage
- Collections
- Categories
- Featured products
- Inspiration gallery
- Completed projects

The goal is to inspire customers and help them discover furniture that matches their style.

---

## Step 2 — Create an Account

Before starting a furniture project, the customer creates an account.

This allows the platform to save:

- Favorites
- Custom designs
- Project requests
- Messages
- Notifications
- Order history

---

## Step 3 — Explore Products

The customer browses available furniture.

Each product provides:

- Images
- Interactive 360° view
- Description
- Materials
- Available colors
- Available customization options
- Estimated starting price

---

## Step 4 — Choose a Purchase Method

The customer has two options:

### Option A — Order as Shown

Purchase the product exactly as displayed without making any modifications.

### Option B — Customize

Open the Design Studio to personalize the product according to the manager's available customization options.

Possible customization includes:

- Dimensions
- Colors
- Materials
- Fabrics
- Product-specific options

---

## Step 5 — Build the Project

Customers may add one or multiple furniture items into a single project request.

Each item keeps its own configuration while belonging to the same overall project.

Customers can modify or remove items before submitting the request.

---

## Step 6 — Submit the Request

Once satisfied, the customer submits the project.

No payment is required at this stage.

The request includes:

- Selected products
- Customizations
- Measurements
- Notes
- Optional reference images

The request is then sent to the manager for review.

---

## Step 7 — Manager Review

The manager reviews the project and prepares:

- Final quotation
- Estimated production time
- Delivery cost (if applicable)
- Additional notes or recommendations

---

## Step 8 — Customer Approval

The customer reviews the manager's proposal.

If satisfied, the customer accepts the quotation.

If not, the customer can discuss changes with the manager through the messaging system.

---

## Step 9 — Payment

After accepting the quotation, the customer pays via bank transfer.

The customer then uploads proof of payment.

The manager manually verifies the payment before production begins.

---

## Step 10 — Production Tracking

Once payment is verified:

- Production begins.
- The customer can monitor progress through the order timeline.
- The manager posts updates whenever the project reaches a new stage.

The platform should keep the customer informed throughout the production process.

---

## Step 11 — Delivery or Pickup

When production is complete, the customer receives a notification.

Depending on the agreed arrangement, the order is:

- Picked up from the workshop, or
- Delivered to the customer's location.

---

## Step 12 — After Delivery

After receiving the furniture, the customer can:

- Leave a rating.
- Write a review.
- Upload optional photos.
- Continue communicating with the manager for future projects.

The completed project remains accessible in the customer's account as part of their order history.

---

# 8. Manager Journey

## Overview

The manager is the central operator of the platform.

Unlike traditional e-commerce systems where orders are automatically fulfilled, the manager personally reviews every customer request, confirms feasibility, determines pricing, estimates production time, verifies payments, and oversees the customer relationship until the order is completed.

The platform is designed to simplify the manager's daily work while maintaining complete control over the business.

---

## Step 1 — Manage the Store

Before customers place orders, the manager prepares the platform by managing:

- Homepage content
- Collections
- Categories
- Products
- Materials
- Colors
- Product customization options
- Product images
- Interactive 360° media
- Policies and informational pages

The manager decides which products are visible to customers.

---

## Step 2 — Receive Customer Requests

When a customer submits a project request, the manager receives a notification.

Each request contains:

- Customer information
- Selected furniture
- Product customizations
- Dimensions
- Notes
- Reference images (if provided)

The manager reviews the request before any payment is requested.

---

## Step 3 — Review and Prepare the Quotation

The manager evaluates the request and determines:

- Final price
- Production feasibility
- Estimated production time
- Delivery cost (if applicable)
- Additional recommendations or notes

The manager may contact the customer if clarification is needed before sending the quotation.

---

## Step 4 — Customer Discussion

If necessary, the manager communicates with the customer through the built-in messaging system.

The goal is to ensure both parties fully understand and agree on the project before payment.

---

## Step 5 — Send Final Quotation

Once everything is confirmed, the manager sends the final quotation.

The quotation includes:

- Final price
- Production estimate
- Delivery details
- Additional notes

The customer can then either accept or reject the quotation.

---

## Step 6 — Verify Payment

After the customer accepts the quotation, they complete a bank transfer and upload proof of payment.

The manager manually verifies the payment.

Production must not begin until payment has been successfully verified.

---

## Step 7 — Manage Production

Once payment is verified, the manager starts production.

Although workers are not part of the platform in Version 1, the manager remains responsible for updating the customer's progress.

Typical production updates may include:

- Production started
- In progress
- Quality inspection
- Ready for pickup or delivery
- Completed

These updates keep customers informed throughout the process.

---

## Step 8 — Delivery or Pickup

When the furniture is finished, the manager arranges the agreed delivery method.

Depending on the quotation, the order will either:

- Be picked up by the customer, or
- Be delivered to the customer's address.

The manager marks the order as completed once it has been successfully received.

---

## Step 9 — After-Sales Management

After completion, the manager can:

- Continue communicating with the customer.
- View customer reviews.
- Respond to reviews if needed.
- Analyze business performance through the dashboard.
- Improve future products based on customer feedback and analytics.

---

## Manager Responsibilities

The manager has complete control over the business, including:

- Product management
- Content management
- Customer communication
- Quotations
- Payment verification
- Production tracking
- Delivery management
- Reviews
- Notifications
- Business analytics
- Platform configuration

The platform should reduce administrative work while allowing the manager to maintain full control over every customer project.

---

# 9. Product System

## Overview

The product system is the foundation of the platform.

Unlike traditional e-commerce websites, products are not fixed inventory items.

Every published product represents a furniture design template that customers can either purchase exactly as displayed or customize according to the options defined by the manager.

The goal is to simplify customization while maintaining complete control over what the workshop can produce.

---

## Product Structure

Each product belongs to:

- One category
- One or more collections
- One furniture type

Every product contains:

- Name
- Description
- Images
- Interactive 360° media
- Starting price
- Available materials
- Available colors
- Available customization options
- Product specifications
- Estimated production information
- Product status

---

## Product Types

The platform should support any type of furniture, including but not limited to:

- Sofas
- Beds
- Dining Tables
- Coffee Tables
- TV Units
- Chairs
- Wardrobes
- Cabinets
- Shelves
- Salons
- Custom Furniture

The system should remain flexible enough to support additional furniture categories in the future.

---

## Product States

Products may exist in different states, including:

- Draft
- Published
- Hidden
- Temporarily Unavailable
- Archived

Only published products are visible to customers.

Archived products remain available for historical orders but cannot be ordered again.

---

## Product Templates

Every published product acts as a configurable template.

Customers have two purchasing options:

### Option 1

Order the product exactly as displayed.

No customization is required.

### Option 2

Customize the product.

Available customization depends entirely on the manager's configuration.

---

## Product Customization

Each product may support different customization options.

Possible configurable fields include:

- Dimensions
- Width
- Height
- Length
- Depth
- Materials
- Fabrics
- Colors
- Finishes
- Product-specific options

Not every product is required to support every option.

The manager decides which options are available for each individual product.

---

## Dimension Rules

Products may define dimension constraints.

Depending on the furniture type, the manager may configure:

- Minimum dimensions
- Maximum dimensions
- Fixed dimensions
- Free dimensions

Some products can be resized easily, while others may have manufacturing limitations.

These rules should be configurable for every product independently.

---

## Materials

Materials are managed centrally by the manager.

Each product can be assigned one or more available materials.

Future material additions should not require application updates.

---

## Colors

Colors are also managed centrally.

Each product can have its own available color palette.

Customers should only see colors that are actually available for the selected product.

---

## Product Media

Every product may contain:

- Cover image
- Gallery
- Detail images
- Interactive 360° viewer

Future versions may include:

- 3D models
- AR visualization
- Product videos

---

## Product Pricing

Displayed prices represent a starting price.

The final price may change depending on:

- Selected dimensions
- Selected materials
- Selected options
- Delivery requirements

Final pricing is confirmed only after the manager reviews the customer's request.

---

## Product Relationships

Products may be related to other products.

Examples include:

- Matching furniture
- Same collection
- Recommended combinations
- Frequently ordered together

These relationships help customers design complete furniture projects rather than purchasing individual pieces.

---

## Product Goal

The product system should feel like browsing a premium furniture showroom while remaining flexible enough to support highly customized furniture projects without overwhelming the customer.

---

# 10. Design Studio

## Overview

The Design Studio is the heart of **بيتي بذوقي**.

It transforms the platform from a traditional furniture catalog into an interactive design experience where customers can personalize furniture according to their needs before requesting a quotation.

The Design Studio should be intuitive, visual, and easy to use, even for customers with no technical knowledge.

Its purpose is to help customers confidently design furniture that matches their home while reducing misunderstandings between the customer and the workshop.

---

## Access

The Design Studio is available from every configurable product.

Customers have two choices:

- Order the product exactly as displayed.
- Open the Design Studio to customize it.

---

## Customization

Available customization depends entirely on the product and on the options configured by the manager.

Possible customization options include:

- Dimensions
- Materials
- Fabrics
- Colors
- Finishes
- Product-specific options

Not every product supports every customization option.

---

## Live Preview

Every modification should immediately update the product preview whenever possible.

Customers should clearly understand how their choices affect the final product before submitting their request.

Future improvements may include:

- Better interactive previews.
- Real-time rendering.
- 3D models.
- AR visualization.

---

## Interactive Product View

Each product should support an interactive media experience.

Version 1 includes:

- High-quality images.
- Gallery and zoom functionality.

Interactive 360° viewing is deferred to Version 1.1 and requires the asset-workflow activation decision in `DECISION_WORKSHOP.md`.

Future versions may support:

- Full 3D models.
- Room placement.
- AR.

---

## Room Visualization

The platform should eventually allow customers to preview furniture inside a room before ordering.

Possible approaches include:

- AI-generated room visualization.
- Uploading a room photo.
- Selecting predefined room templates.

The objective is to help customers visualize furniture in a realistic environment and reduce purchase uncertainty.

This feature is considered an advanced feature and is not required for Version 1.

---

## Price Estimation

The Design Studio may display an estimated starting price based on the selected configuration.

The displayed value is only an estimate.

The final quotation is always prepared and approved by the manager.

---

## Validation

The Design Studio should prevent customers from creating configurations that the workshop cannot manufacture.

Examples include:

- Invalid dimensions.
- Unsupported materials.
- Unavailable colors.
- Conflicting options.

Validation rules are configured by the manager for each product.

---

## Save Design

Authenticated customers should be able to save unfinished designs.

Saved designs can later be:

- Edited.
- Added to a project.
- Compared.
- Shared with the manager.

---

## Project Integration

Customized products are added to a project request rather than being purchased immediately.

A single project may contain multiple customized or standard furniture items.

Each product keeps its own configuration.

---

## Customer Experience Goals

The Design Studio should make customers feel involved in the creation process rather than simply selecting products from a catalog.

The experience should be:

- Simple.
- Visual.
- Interactive.
- Fast.
- Premium.
- Confidence-inspiring.

The customer should finish the process feeling that the furniture was designed specifically for their home.

---

# 11. Order & Quotation System

## Overview

The platform follows a quotation-based ordering workflow rather than a traditional checkout process.

Customers do not immediately purchase furniture.

Instead, they submit a project request that is reviewed by the manager before any payment is made.

This approach ensures that every project is technically feasible, correctly priced, and fully agreed upon before production begins.

---

## Project Requests

A project request represents the customer's furniture project.

Each project may contain:

- One or multiple furniture items.
- Standard products.
- Customized products.
- Customer notes.
- Reference images (optional).

A project remains editable until it is submitted.

---

## Quotation Workflow

Once submitted, the manager reviews the project and prepares a quotation.

The quotation includes:

- Final price.
- Estimated production time.
- Delivery cost (if applicable).
- Additional notes or recommendations.

The quotation is then sent to the customer for review.

---

## Customer Decision

After receiving the quotation, the customer has two options:

### Accept

The customer agrees to all terms and proceeds to payment.

### Request Changes

If the customer is not satisfied with the quotation or production estimate, they can discuss the project with the manager before making a final decision.

No payment is requested until both parties reach an agreement.

---

## Payment Approval

Once the quotation is accepted:

- The customer completes a bank transfer.
- Uploads proof of payment.
- The manager manually verifies the payment.

Production begins only after successful payment verification.

---

## Order Lifecycle

Every order moves through a series of statuses.

Typical statuses include:

- Draft
- Submitted
- Under Review
- Waiting for Customer Response
- Quotation Accepted
- Waiting for Payment
- Payment Verification
- Production Started
- In Production
- Ready for Pickup / Delivery
- Completed
- Cancelled

The manager is responsible for updating the order status throughout its lifecycle.

---

## Order History

Accepted quotations and completed orders should remain permanently stored.

Historical orders must not change even if:

- Product information changes.
- Prices change.
- Materials change.
- Colors become unavailable.
- Products are archived.

Every order represents a permanent snapshot of what the customer agreed to purchase.

---

## Customer Experience Goals

The ordering process should feel transparent and collaborative.

Customers should always know:

- The current order status.
- The next expected step.
- What action is required from them.
- Estimated production timeline.
- Payment status.

The goal is to eliminate uncertainty and build trust throughout the entire purchasing journey.

---

# 12. Customer Dashboard

## Overview

The Customer Dashboard is the customer's personal workspace within the platform.

It provides a centralized location where customers can manage their account, furniture projects, orders, saved designs, favorites, and communication with the manager.

The dashboard should feel simple, organized, and premium while allowing customers to quickly understand the current state of their projects.

---

## Dashboard Home

The dashboard homepage should provide a quick overview of the customer's activity.

It may display:

- Active projects.
- Current order status.
- Pending quotations.
- Recent notifications.
- Recent messages.
- Recently viewed products.
- Recommended products.

The objective is to help customers immediately continue where they left off.

---

## My Projects

Customers can view all furniture projects.

Each project displays:

- Project name.
- Number of furniture items.
- Current status.
- Creation date.
- Last updated.
- Estimated completion date (if available).

Customers can open any project to view its complete details.

---

## My Orders

Customers can access their complete order history.

For each order they can:

- View quotation.
- View payment status.
- Track production.
- View delivery information.
- View order timeline.
- Download important documents (future).
- Leave a review after completion.

---

## Saved Designs

Customers can save furniture configurations without submitting them.

Saved designs allow customers to:

- Continue editing later.
- Duplicate designs.
- Compare multiple versions.
- Add designs to a future project.

---

## Favorites

Customers can save products they like.

Favorites help customers quickly return to products they are considering for future projects.

---

## Messages

The dashboard provides access to the conversation with the manager.

Customers can:

- Send messages.
- Receive replies.
- Share images.
- Share reference files.
- Continue discussions about existing or future projects.

---

## Notifications

Customers receive notifications for important events such as:

- New quotation.
- Payment confirmation.
- Production updates.
- Delivery updates.
- New manager messages.

Unread notifications should be clearly highlighted.

---

## Account Settings

Customers can manage:

- Personal information.
- Contact details.
- Password.
- Preferred language.
- Notification preferences.

Future versions may include additional personalization options.

---

## Reviews

Customers can view reviews they have submitted and write new reviews for completed orders.

Reviews may include:

- Rating.
- Written feedback.
- Optional photos.

Only verified completed orders can receive reviews.

---

## Customer Experience Goals

The Customer Dashboard should provide complete visibility into every stage of the customer's relationship with the business.

Customers should always know:

- What they have ordered.
- What is currently happening.
- What action is expected next.
- How to contact the manager.

The dashboard should reduce uncertainty while making customers feel connected to the creation of their furniture.

---

# 13. Manager Dashboard

## Overview

The Manager Dashboard is the operational center of the platform.

It allows the manager to control every aspect of the business from a single interface without requiring technical knowledge.

The dashboard should prioritize efficiency, clarity, and speed while maintaining the premium experience of the platform.

---

## Dashboard Home

The homepage provides an overview of the business.

It may include:

- New project requests.
- Pending quotations.
- Orders awaiting payment verification.
- Active production orders.
- Orders ready for delivery or pickup.
- Recent customer messages.
- Notifications.
- Business statistics.

The objective is to help the manager quickly understand what requires attention.

---

## Product Management

The manager can manage the complete product catalog, including:

- Products.
- Categories.
- Collections.
- Materials.
- Colors.
- Product customization options.
- Product visibility.
- Product media.
- Product descriptions.

Products can be created, edited, hidden, published, or archived without affecting historical orders.

---

## Content Management (CMS)

The manager controls all customer-facing content, including:

- Homepage.
- Featured sections.
- Banners.
- Collections.
- About page.
- FAQ.
- Policies.
- Contact information.

No source code changes should be required to update website content.

---

## Project Requests

The manager receives all customer project requests.

For each request, the manager can:

- Review selected products.
- Review customizations.
- Review customer notes.
- Review uploaded reference images.
- Contact the customer.
- Prepare a quotation.

---

## Quotations

The manager prepares and sends quotations.

Each quotation may include:

- Final price.
- Estimated production time.
- Delivery cost.
- Additional notes.

Customers must approve the quotation before payment begins.

---

## Payment Verification

The manager manually verifies bank transfer payments.

The manager can:

- View uploaded payment proof.
- Accept payment.
- Reject payment.
- Request a new payment proof.

Production begins only after payment verification.

---

## Order Management

The manager controls the complete order lifecycle.

For each order, the manager can:

- Update status.
- Update production progress.
- Add production notes.
- Mark orders as completed.
- Manage pickup or delivery.

Customers automatically receive updates whenever the order progresses.

---

## Customer Communication

The manager communicates with customers through the built-in messaging system.

The manager can:

- Reply to messages.
- Send images.
- Send files.
- Answer questions.
- Clarify quotations.
- Discuss customization requests.

---

## Reviews

The manager can:

- View customer reviews.
- Reply to reviews.
- Report inappropriate content (future).

Reviews cannot be edited by the manager.

---

## Notifications

The manager receives notifications for important business events, including:

- New project requests.
- New customer messages.
- Payment proofs awaiting verification.
- Customer quotation responses.
- New reviews.

---

## Analytics

The dashboard provides business insights such as:

- Total orders.
- Active projects.
- Revenue.
- Most viewed products.
- Most ordered products.
- Most popular materials.
- Most popular colors.
- Conversion rate.
- Customer growth.

These analytics help the manager make informed business decisions.

---

## Settings

The manager can configure business preferences, including:

- Business information.
- Contact details.
- Supported delivery methods.
- Notification preferences.
- Language settings.
- General platform configuration.

---

## Manager Experience Goals

The Manager Dashboard should function as the complete digital workspace for the business.

The manager should be able to operate the entire platform—from publishing products to completing customer orders—without needing external tools or technical knowledge.

The interface should remain clean, efficient, and optimized for both desktop and mobile devices.

---

# 14. Content Management System (CMS)

## Overview

The Content Management System (CMS) allows the manager to control the entire customer-facing experience without modifying the application's source code.

The CMS should be simple, organized, and flexible enough to support future business growth while remaining easy to use.

Its primary goal is to give the manager full control over the platform's content and business configuration.

---

## Homepage Management

The manager can customize the homepage by managing:

- Hero section.
- Featured collections.
- Featured products.
- Promotional banners.
- Inspiration sections.
- Custom content blocks.

Homepage sections can be enabled, disabled, reordered, or updated at any time.

---

## Product Management

The CMS allows the manager to:

- Create products.
- Edit products.
- Publish products.
- Hide products.
- Archive products.

For each product, the manager can manage:

- Name.
- Description.
- Category.
- Collection.
- Starting price.
- Materials.
- Colors.
- Product options.
- Dimension rules.
- Images.
- Interactive 360° media.

---

## Collection Management

The manager can create and manage collections to organize products into meaningful groups.

Collections help customers browse furniture more easily and create complete room designs.

---

## Category Management

The manager can create, edit, and organize furniture categories.

The system should remain flexible enough to support any furniture type without requiring application changes.

---

## Materials Management

Materials are managed centrally.

The manager can:

- Create materials.
- Edit materials.
- Remove unused materials.
- Assign materials to products.

Only assigned materials are visible to customers.

---

## Color Management

Colors are managed independently from products.

The manager can:

- Create colors.
- Edit colors.
- Remove colors.
- Assign available colors to specific products.

Customers should only see colors that are actually available for the selected product.

---

## Product Option Management

Each product may have its own customization options.

The manager defines:

- Available options.
- Option values.
- Dimension limits.
- Required fields.
- Optional fields.

This allows every product to have its own customization experience.

---

## Media Management

The manager can upload and manage:

- Product images.
- Gallery images.
- Interactive 360° media.
- Inspiration images.
- Homepage banners.

Future versions may include support for videos and 3D models.

---

## Content Pages

The CMS allows the manager to manage informational pages, including:

- About Us.
- Contact.
- FAQ.
- Privacy Policy.
- Terms and Conditions.
- Warranty Information.

Additional pages should be supported without requiring code changes.

---

## Translation Management

Arabic is the primary content language.

The manager creates content in Arabic.

AI may generate French and English translations.

The manager reviews and approves translations before publication.

---

## Visibility Management

The manager controls what customers can see.

Examples include:

- Draft content.
- Published content.
- Hidden products.
- Archived products.
- Homepage visibility.

---

## CMS Goals

The CMS should allow the manager to operate and update the entire website independently.

Most business changes—including products, content, customization options, and homepage updates—should be possible without developer assistance.

The CMS should remain intuitive, efficient, and scalable as the business grows.

---

# 15. Notifications & Communication

## Overview

Communication is a core part of the customer experience.

Unlike traditional e-commerce platforms where customers simply place an order and wait, **بيتي بذوقي** encourages continuous communication between the customer and the manager throughout the entire furniture creation process.

The platform should ensure that customers are always informed about important events while giving the manager an efficient way to communicate with customers.

---

## Notifications

The platform should notify users whenever important events occur.

Examples include:

### Customer Notifications

- Account created.
- New quotation available.
- Quotation accepted.
- Payment reminder.
- Payment verified.
- Production started.
- Production progress updated.
- Furniture ready for pickup or delivery.
- Order completed.
- New message from the manager.

---

### Manager Notifications

- New customer registration.
- New project request.
- Customer message received.
- Customer accepted quotation.
- Payment proof uploaded.
- New customer review.

---

## Notification Channels

Version 1 should support:

- In-app notifications.
- Email notifications.

Push notifications are proposed for Version 1.1 and require evidence that the additional channel is useful.

The notification system should be flexible enough to support additional channels in future versions.

---

## Messaging System

Customers and the manager communicate through a built-in messaging system.

The conversation remains continuous instead of creating separate chats for every order.

Messages can be used for:

- Asking questions.
- Discussing customization.
- Clarifying measurements.
- Explaining quotations.
- Sharing production updates.
- General customer support.

---

## Attachments

The messaging system should support:

- Text messages.
- Images.
- Documents.
- Reference photos.

This allows customers to share inspiration and the manager to provide visual explanations when necessary.

---

## Communication Principles

Communication should be:

- Clear.
- Professional.
- Friendly.
- Fast.
- Transparent.

Customers should never feel uncertain about the status of their project.

---

## Future Improvements

Future versions may include:

- Voice messages.
- Video attachments.
- Video consultations.
- WhatsApp integration.
- Automatic AI-generated message summaries.
- Smart suggested replies for the manager.

---

## Goals

The communication system should strengthen trust between the customer and the workshop.

Customers should always know:

- What is happening.
- Why it is happening.
- What action is expected next.
- How to contact the manager if needed.

The platform should reduce uncertainty by making communication simple, accessible, and transparent throughout the entire customer journey.

---

# 16. AI Features & Intelligence

## Overview

Artificial Intelligence is designed to enhance the customer experience, simplify business operations, and assist both customers and the manager throughout the platform.

AI is an assistant, not a decision-maker.

Its purpose is to reduce effort, improve product discovery, and provide intelligent recommendations while leaving all important business decisions to humans.

The platform must remain fully functional even if AI services are unavailable.

---

## AI Philosophy

The role of AI is to assist, recommend, and automate simple tasks.

It must never replace the manager or make business-critical decisions.

Final decisions always belong to humans.

---

## Customer AI Features

AI may assist customers by:

- Recommending furniture based on browsing history.
- Suggesting similar products.
- Recommending matching furniture from the catalog.
- Suggesting materials.
- Suggesting colors.
- Helping customers discover products using natural language search.
- Assisting with product customization.
- Recommending complete furniture combinations.

Future versions may include:

- AI room visualization.
- AI interior design suggestions.
- AI style recommendations.
- AI furniture placement previews.

---

## Manager AI Features

AI may assist the manager by:

- Translating Arabic content into French and English.
- Suggesting product descriptions.
- Improving written content.
- Generating SEO-friendly text.
- Organizing CMS content.
- Summarizing customer conversations.
- Assisting with customer support replies.

The manager always reviews AI-generated content before publication.

---

## AI Search

The platform should support intelligent search.

Customers should be able to search naturally using everyday language instead of exact product names.

Examples:

- "Large modern sofa"
- "White bedroom furniture"
- "Small dining table"

AI should interpret customer intent and recommend the most relevant published products.

---

## AI Recommendations

Recommendations should always be based on real products available in the platform.

AI should never invent products or configurations that do not exist.

Recommendations may be based on:

- Customer preferences.
- Browsing history.
- Favorite products.
- Similar customers.
- Product popularity.
- Matching collections.

---

## AI Translation

Arabic is the primary language.

AI assists by generating French and English translations for:

- Products.
- Collections.
- CMS pages.
- Notifications.
- Product descriptions.

All translations require manager approval before becoming public.

---

## AI Limitations

AI must never:

- Approve quotations.
- Approve payments.
- Verify payment proofs.
- Approve production.
- Modify customer orders automatically.
- Change business settings.
- Publish content without manager approval.

---

## Reliability

The platform should gracefully handle AI failures.

If AI becomes unavailable:

- Customers can continue browsing.
- Products remain searchable using normal search.
- Orders continue normally.
- Messaging continues.
- CMS remains fully functional.

AI should improve the experience but must never become a dependency for core business operations.

---

## Future Vision

As the platform evolves, AI may become a creative assistant capable of helping customers design complete living spaces while remaining grounded in the real product catalog.

Future AI capabilities may include:

- Complete room design assistance.
- Automatic furniture recommendations from room photos.
- Personalized shopping experiences.
- Intelligent design suggestions.
- AI-generated room mockups.
- Smart business insights for the manager.

All future AI features should continue following the core philosophy:

**AI assists. Humans decide.**

---

# 17. Analytics & Business Intelligence

## Overview

The platform should provide the manager with meaningful insights into business performance, customer behavior, and product popularity.

The goal of analytics is not simply to display numbers, but to help the manager understand how customers interact with the platform and make better business decisions.

Analytics should be presented through simple and easy-to-understand dashboards.

---

## Business Analytics

The platform should provide general business statistics, including:

- Total customers.
- Total project requests.
- Total quotations.
- Accepted quotations.
- Completed orders.
- Cancelled orders.
- Total revenue.
- Average order value.

---

## Product Analytics

The manager should be able to understand product performance through metrics such as:

- Most viewed products.
- Most ordered products.
- Most customized products.
- Least viewed products.
- Least ordered products.
- Most popular collections.
- Most popular categories.

These insights help identify which furniture designs attract the most customer interest.

---

## Customization Analytics

Since customization is a core feature of the platform, analytics should include:

- Most selected colors.
- Most selected materials.
- Most requested dimensions.
- Most popular product options.
- Most common customization combinations.

These insights help the manager understand customer preferences and improve future offerings.

---

## Customer Analytics

The platform should provide information about customer activity, including:

- New customer registrations.
- Returning customers.
- Active customers.
- Customer order history.
- Customer lifetime value (future).

The objective is to better understand customer behavior and encourage repeat business.

---

## Order Analytics

The manager should be able to monitor the overall order pipeline, including:

- Orders awaiting review.
- Pending quotations.
- Awaiting payment verification.
- Orders in production.
- Ready for delivery or pickup.
- Completed orders.

This provides a clear overview of the business workflow at any given time.

---

## Search Analytics

The platform should monitor how customers search for products.

Examples include:

- Most searched keywords.
- Searches with no results.
- Most filtered categories.
- Most popular search filters.

These insights can help improve the product catalog and customer experience.

---

## Dashboard Visualization

Analytics should be presented using clear and visually appealing charts, graphs, and summary cards.

The interface should allow the manager to quickly understand business performance without needing technical knowledge.

---

## Future Improvements

Future versions may include:

- AI-generated business insights.
- Sales forecasting.
- Customer trend analysis.
- Seasonal demand predictions.
- Product performance recommendations.
- Custom analytics reports.

---

## Goals

The analytics system should help the manager answer questions such as:

- Which products are most popular?
- Which materials do customers prefer?
- Which colors sell the most?
- Where do customers abandon projects?
- How is the business performing over time?

The objective is to transform business data into useful information that supports better decision-making and continuous improvement.

---

# 18. Security & Privacy

## Overview

Security and privacy are fundamental to the platform.

Customers trust **بيتي بذوقي** with their personal information, project details, payment proofs, and conversations.

The platform should protect this information while providing a secure and trustworthy experience for both customers and the manager.

---

## Authentication

Customers must create an account before accessing personalized features.

Authenticated users can:

- Submit project requests.
- Save designs.
- Save favorite products.
- View orders.
- Chat with the manager.
- Track production.
- Leave reviews.

Only the manager has administrative access to business management features.

---

## Authorization

Every user should only access information that belongs to them.

Customers cannot:

- View other customers' orders.
- View other customers' messages.
- Access manager functions.
- Modify business content.

The manager has full administrative access to the platform.

---

## Customer Data

The platform stores customer information necessary for operating the business, including:

- Personal information.
- Contact information.
- Project requests.
- Order history.
- Saved designs.
- Messages.
- Reviews.

Customer information should be protected and never exposed to unauthorized users.

---

## Payment Information

Payments are completed outside the platform using bank transfer.

The platform does not store bank card information.

Customers upload payment proof, which is reviewed manually by the manager before production begins.

Payment proof should only be accessible to the manager and the customer who uploaded it.

---

## Media & Files

Customers may upload:

- Payment proof.
- Reference images.
- Attachments in messages.

Uploaded files should remain private unless intentionally published by the manager.

---

## Privacy Principles

The platform should collect only the information required to operate the business.

Customer information should never be shared or exposed without authorization.

Users should always have control over their own account information.

---

## Business Continuity

Customer orders, quotations, and project history are valuable business records.

The platform should be designed to protect this information from accidental loss and allow future backup and recovery strategies.

---

## Future Considerations

Future versions may include:

- Two-factor authentication.
- Login notifications.
- Session management.
- Activity history.
- Enhanced security monitoring.
- Automated backup management.

---

## Goals

The security model should provide a safe and trustworthy environment for both customers and the manager while remaining simple enough for everyday business use.

Customers should feel confident that their personal information, conversations, project details, and payment documents are protected throughout the entire customer journey.

---

# 19. Future Vision

## Overview

While Version 1 focuses on building a reliable and complete digital furniture atelier for a single business, the platform should be architected with future expansion in mind.

Future features should be easy to integrate without requiring major architectural changes or rewriting core business logic.

The goal is to build a strong foundation today that supports long-term growth tomorrow.

---

## Business Expansion

Future versions may support:

- Multiple furniture workshops.
- Multiple managers.
- Multiple branches or showrooms.
- Different business locations.
- Multi-tenant architecture.
- Franchise support.

Version 1 intentionally supports only a single business and a single manager.

---

## Customer Experience

The customer experience may evolve to include:

- AI-powered room design.
- Full 3D furniture customization.
- Augmented Reality (AR) furniture placement.
- Complete room planning.
- Personalized home profiles.
- Wishlists for future projects.
- Design inspiration boards.
- Furniture comparison tools.

These features aim to make furniture customization even more interactive and confidence-inspiring.

---

## AI Evolution

Future AI capabilities may include:

- Complete interior design assistance.
- AI room analysis from uploaded photos.
- Furniture placement recommendations.
- Budget-based furniture suggestions.
- Personalized shopping experiences.
- AI-generated room concepts.
- Business insights for the manager.
- Intelligent customer support assistance.

AI should always remain an assistant and never replace human decision-making.

---

## Business Management

Future versions may introduce:

- Worker accounts.
- Workshop management.
- Production scheduling.
- Inventory management.
- Supplier management.
- Material stock tracking.
- Purchase management.
- Financial reporting.
- Employee permissions.

These features are intentionally excluded from Version 1.

---

## Commerce

As the business grows, the platform may support:

- Additional payment methods.
- Online payment gateways.
- Installment payments.
- Promotional campaigns.
- Discount systems.
- Gift cards.
- Customer loyalty programs.
- Referral programs.

The current business workflow remains based on quotation approval followed by bank transfer.

---

## Mobile Applications

The platform should eventually expand beyond the web by providing:

- Native Android application.
- Native iOS application.
- Manager mobile application.
- Customer mobile application.

The overall user experience should remain consistent across all platforms.

---

## Integrations

Future integrations may include:

- ERP systems.
- Accounting software.
- Shipping providers.
- CRM platforms.
- Marketing tools.
- Analytics platforms.
- Email marketing services.
- WhatsApp integration.

The platform architecture should remain flexible enough to support these integrations.

---

## Technical Vision

Future development should prioritize:

- Scalability.
- Maintainability.
- Performance.
- Security.
- Modular architecture.
- API-first design.
- Cloud-ready deployment.

Every architectural decision made in Version 1 should avoid limiting future growth.

---

## Long-Term Goal

The long-term vision is for **بيتي بذوقي** to become the leading digital platform for custom furniture in Morocco, combining premium craftsmanship with modern technology.

The platform should continue evolving while remaining faithful to its core philosophy:

- Premium experience.
- Personal craftsmanship.
- Visual-first design.
- Customer collaboration.
- Transparency.
- Trust.
- Simplicity.

Every future feature should strengthen these principles rather than compromise them.

---

# 20. Open Decisions & Assumptions

## Overview

This section contains decisions that have not yet been finalized during the discovery phase.

These items should not be assumed by AI agents during implementation.

Whenever possible, the implementation should remain flexible enough to support different future decisions.

---

## Business Decisions

The following business details still require final confirmation:

- Final product pricing strategy.
- Warranty duration and conditions.
- Delivery pricing rules.
- Delivery service coverage.
- Production capacity.
- Refund and cancellation policy after payment.
- Return policy for custom furniture.

---

## Technical Decisions

The following technical decisions have not yet been finalized:

- Technology stack.
- Authentication provider.
- AI provider.
- Hosting provider.
- Cloud infrastructure.
- Storage provider.
- Email service.
- Push notification service.

These choices should be selected during the technical planning phase based on the project's requirements and budget.

---

## Product Decisions

Some product features require additional discussion before implementation, including:

- Room visualization approach.
- 3D model workflow.
- Augmented Reality implementation.
- Saved home profiles.
- Advanced product comparison.
- AI-powered room planning.

These features are considered future enhancements and are not required for Version 1.

---

## Assumptions

The current project assumes:

- One furniture business.
- One manager.
- Customers primarily use mobile devices.
- Arabic is the primary language.
- Furniture is produced only after payment verification.
- Customers are willing to communicate with the manager before production begins.

If any of these assumptions change, the affected sections of this document should be reviewed and updated.

---

## Future Decisions

As the project evolves, additional decisions may be added to this section.

Once a decision is finalized, it should be moved into the appropriate section of this document and no longer treated as an open decision.

---

## Guiding Principle

When an implementation depends on an undecided requirement, AI agents should:

1. Avoid making permanent assumptions.
2. Choose the most flexible architecture possible.
3. Clearly identify the dependency.
4. Request clarification when necessary.

The objective is to prevent incorrect implementation caused by assumptions that have not yet been validated.

---

# 21. Business Rules

## Overview

The following business rules define how the platform operates.

These rules are considered core business logic and should always take precedence over implementation decisions.

Any future modifications to these rules should be reflected in this document before implementation.

---

## Business Structure

- Version 1 supports a single furniture business.
- Version 1 supports a single manager.
- Worker accounts are not included in Version 1.
- The platform is designed for made-to-order furniture rather than stock-based selling.

---

## Product Rules

- Every product acts as a configurable furniture template.
- Customers may purchase a product exactly as displayed.
- Customers may customize a product only using options provided by the manager.
- Every product may have its own customization rules.
- The manager controls all available materials, colors, dimensions, and product options.
- Hidden or archived products must not affect historical orders.

---

## Customer Rules

- Customers must create an account before submitting a project request.
- Customers may create projects containing multiple furniture items.
- Customers may edit their project until it is submitted.
- Customers may save favorite products.
- Customers may save unfinished designs.
- Only verified customers may leave reviews.

---

## Quotation Rules

- Every order begins as a project request.
- No payment is requested before the manager reviews the request.
- The manager prepares the final quotation.
- Customers must approve the quotation before payment.
- The quotation becomes the agreed version of the project.

---

## Payment Rules

- Version 1 only supports bank transfer.
- Customers upload proof of payment.
- Payment verification is performed manually by the manager.
- Production must never begin before payment verification.
- The platform does not process or store bank card information.

---

## Production Rules

- Production starts only after payment verification.
- The manager is responsible for updating production progress.
- Customers can track production through the platform.
- Production history should remain available after order completion.

---

## Order Rules

- Every order maintains its own history.
- Historical orders must never change when products are edited.
- Orders move through predefined statuses.
- Customers should always know the current order status and the next expected step.

---

## Communication Rules

- Communication takes place through a continuous conversation between the customer and the manager.
- Customers and managers may exchange text, images, and files.
- Important business events should generate notifications.

---

## AI Rules

AI is an assistant only.

AI may:

- Recommend products.
- Recommend colors.
- Recommend materials.
- Translate content.
- Improve search.
- Suggest furniture combinations.

AI must never:

- Approve quotations.
- Approve payments.
- Verify payment proof.
- Approve production.
- Change business data automatically.
- Publish content without manager approval.

The platform must remain fully functional if AI services become unavailable.

---

## CMS Rules

The manager controls all business content through the CMS.

This includes:

- Products.
- Collections.
- Categories.
- Homepage.
- Content pages.
- Materials.
- Colors.
- Product options.
- Media.

Business configuration should not require source code modifications.

---

## Platform Rules

- Arabic is the default language.
- Mobile experience is prioritized.
- Accessibility is considered a core requirement.
- Performance is treated as a feature.
- The customer experience should remain simple, premium, and transparent.

---

## Guiding Principle

Whenever uncertainty exists, implementation should follow this priority:

1. Business Rules.
2. Customer Experience.
3. Product Philosophy.
4. Technical Implementation.

Technology should adapt to the business—not the other way around.

---

# 22. Design Principles

## Overview

The design of **بيتي بذوقي** should communicate quality, craftsmanship, and trust.

The platform should feel like entering a premium furniture showroom rather than browsing a traditional online store.

Every design decision should contribute to a calm, elegant, and enjoyable user experience.

---

## Design Philosophy

The overall experience should be:

- Premium
- Elegant
- Modern
- Warm
- Minimal
- Visual-first
- Professional
- Timeless

The design should focus on quality rather than visual complexity.

---

## Simplicity

Interfaces should remain clean and easy to understand.

Every page should present only the information necessary for the current task.

Unnecessary elements, excessive animations, or distracting visuals should be avoided.

---

## Visual-First Experience

Furniture is a visual product.

Customers should be encouraged to explore products through:

- High-quality photography.
- Interactive 360° views.
- Large product previews.
- Visual option selectors.

The interface should rely on images whenever possible instead of long text descriptions.

---

## Premium User Experience

Every interaction should communicate attention to detail.

Examples include:

- Smooth transitions.
- Consistent spacing.
- Elegant typography.
- High-quality icons.
- Clear visual hierarchy.
- Thoughtful micro-interactions.

Premium should be reflected through usability rather than decoration.

---

## Consistency

The entire platform should follow a single design language.

Buttons, forms, colors, spacing, typography, icons, and layouts should remain consistent across every page.

Users should never feel like they are using different applications.

---

## Customer Confidence

The design should reduce uncertainty.

Customers should always understand:

- What they are viewing.
- What they are customizing.
- What the next step is.
- What action is required.

Important information should always be visible and easy to understand.

---

## Mobile-First Design

The experience should be designed primarily for mobile devices.

Desktop layouts should extend the mobile experience rather than replace it.

Every important workflow should remain comfortable and intuitive on smaller screens.

---

## Accessibility

Accessibility should be considered from the beginning.

The platform should be usable by as many people as possible through:

- Readable typography.
- Good color contrast.
- Keyboard accessibility.
- Clear navigation.
- Responsive layouts.

Accessibility is part of the product's quality, not an optional enhancement.

---

## Brand Consistency

Every page should reinforce the identity of **بيتي بذوقي**.

Customers should always feel they are interacting with the same premium brand, whether they are browsing products, customizing furniture, messaging the manager, or tracking an order.

---

## Design Goal

The design should make customers feel inspired, confident, and excited to create furniture for their home.

The experience should remain simple enough for first-time users while reflecting the craftsmanship and professionalism of the business.

---

# 23. Technical Principles

## Overview

The technical architecture of **بيتي بذوقي** should prioritize long-term maintainability, scalability, security, and flexibility.

Technology should support the business, not dictate it.

Every technical decision should make the platform easier to maintain, extend, and improve over time.

---

## Architecture Philosophy

The platform should be built using a clean, modular architecture where each part of the system has a clear responsibility.

Business logic, user interface, data management, and integrations should remain separated whenever possible.

The architecture should encourage code reuse, consistency, and simplicity.

---

## Scalability

Although Version 1 supports only a single furniture business, the architecture should be designed to support future expansion without major redesign.

Future growth may include:

- Multiple businesses.
- Multiple managers.
- Multiple showrooms.
- Additional services.
- Mobile applications.
- Third-party integrations.

These capabilities should be considered during architecture design but not implemented unless required.

---

## Maintainability

The project should remain easy to maintain as it grows.

New features should be added without affecting existing functionality whenever possible.

The codebase should remain organized, predictable, and easy for new developers or AI agents to understand.

---

## Performance

Performance is considered a core product feature.

The platform should load quickly, remain responsive, and provide a smooth user experience across both desktop and mobile devices.

Large media files, interactive content, and future AI features should be optimized to avoid degrading the overall experience.

---

## Security

Security should be integrated into the architecture from the beginning.

Authentication, authorization, data protection, file handling, and customer privacy should be treated as core architectural requirements rather than optional improvements.

---

## Configuration

Business rules should be configurable whenever practical.

Products, materials, colors, pricing rules, homepage content, and other business settings should be managed through the CMS instead of requiring source code modifications.

---

## Localization

The architecture should fully support multilingual content.

Arabic, French, and English should be treated as first-class languages, allowing additional languages to be introduced in the future with minimal changes.

---

## AI Integration

Artificial Intelligence should be implemented as an optional service.

The platform must continue functioning normally if AI services become unavailable.

AI integrations should remain isolated from the platform's core business logic.

---

## Future-Proof Design

The architecture should avoid decisions that limit future growth.

When possible, technical solutions should remain flexible enough to support future business requirements without requiring significant rewrites.

---

## Technical Goal

The objective is to build a reliable, scalable, and maintainable platform that can evolve with the business while remaining simple enough to support Version 1 efficiently.

Every technical decision should support the project's core philosophy of delivering a premium, trustworthy, and long-lasting customer experience.

---

# 24. Risks & Challenges

## Overview

Every software project faces technical, business, and operational challenges.

The purpose of this section is to identify the most important risks discovered during the product discovery phase so they can be considered during planning and implementation.

These risks are not blockers, but they should influence future architectural and product decisions.

---

## Business Risks

### Pricing Complexity

Furniture pricing is highly dependent on multiple variables such as dimensions, materials, customization options, and delivery requirements.

The pricing system should remain flexible enough to support future business changes without requiring significant redevelopment.

---

### Customer Expectations

Customers may expect the final product to exactly match images or digital previews.

The platform should clearly communicate that images, visualizations, and future AI previews are intended to help customers understand the design but may not represent the final handcrafted product with absolute precision.

---

### Production Estimates

Production times may vary depending on workload, material availability, or unexpected circumstances.

Estimated production dates should always be presented as estimates rather than guarantees.

---

## Technical Risks

### Media Performance

High-resolution images and interactive 360° media may increase loading times if not properly optimized.

Performance should remain a priority throughout the platform.

---

### AI Dependency

Some future features rely on Artificial Intelligence.

The platform must continue operating normally if AI services become unavailable, fail, or produce unsatisfactory results.

---

### Future Scalability

Version 1 is intentionally simple.

However, architectural decisions should avoid making future expansion unnecessarily difficult.

Future support for multiple businesses, additional managers, or new services should remain possible.

---

## User Experience Risks

### Complex Customization

Offering too many customization options at once may overwhelm customers.

The Design Studio should remain simple and progressively guide users through the customization process.

---

### Communication Delays

Because quotations and production require manual review, customers may experience waiting periods.

The platform should minimize uncertainty by providing clear order statuses, notifications, and expected next steps.

---

## Business Growth Risks

As the business expands, additional operational requirements may emerge, including:

- Larger product catalogs.
- Increased customer volume.
- Multiple production locations.
- Additional administrative roles.
- More advanced reporting requirements.

The platform should be prepared to evolve without compromising stability.

---

## Guiding Principle

When facing uncertainty, the platform should prioritize:

- Simplicity over unnecessary complexity.
- Flexibility over rigid solutions.
- Customer trust over automation.
- Long-term maintainability over short-term convenience.

These principles should guide future product and technical decisions as the platform continues to grow.

---

# 25. Pending Decisions

## Overview

The following decisions have not yet been finalized during the product discovery phase.

These items should not be assumed during implementation.

Where possible, the system should remain flexible until these decisions are confirmed.

---

## Business

The following business decisions still require confirmation:

- Final pricing strategy.
- Delivery pricing model.
- Warranty duration and coverage.
- Delivery service area.
- Production capacity.
- Cancellation policy after payment.
- Refund policy.

---

## Product

The following product decisions remain open:

- Final room visualization approach.
- 3D model workflow.
- Augmented Reality implementation.
- Saved home profiles.
- Product comparison enhancements.
- AI room designer.

---

## Technical

The following technical decisions will be made during the architecture phase:

- Technology stack.
- Authentication provider.
- AI provider.
- Hosting provider.
- Database provider.
- File storage solution.
- Email provider.
- Push notification service.
- Payment proof storage strategy.

---

## Design

The following design decisions are still under consideration:

- Brand color palette.
- Typography.
- Design system.
- Animation style.
- Illustration style.

---

## Guiding Principle

Until these decisions are finalized, implementation should avoid making rigid assumptions.

Whenever possible, solutions should remain configurable and future-proof.

Once a decision is approved, this section should be updated and the corresponding documentation revised.

# 26 Final Product Goal

## Vision

The ultimate goal of **بيتي بذوقي** is to become the leading digital platform for custom furniture in Morocco by combining traditional craftsmanship with modern technology.

The platform should redefine how customers discover, customize, order, and follow the creation of made-to-order furniture.

Rather than functioning as a traditional online furniture store, **بيتي بذوقي** should provide a complete digital atelier experience where every customer feels involved in the creation of furniture designed specifically for their home.

---

## Mission

Create a platform that simplifies the entire custom furniture journey while maintaining the personal relationship between the customer and the workshop.

Technology should remove complexity, improve communication, and build trust without replacing the craftsmanship that makes the business unique.

---

## Customer Experience

Every customer should feel:

- Inspired while discovering products.
- Confident while customizing furniture.
- Informed throughout the ordering process.
- Connected during production.
- Satisfied after delivery.

The platform should eliminate uncertainty and make customers feel that their furniture is being created specifically for them.

---

## Business Experience

The platform should become the manager's primary business tool.

The manager should be able to operate the business efficiently through a single system without needing technical knowledge or multiple disconnected applications.

Business management should remain simple, flexible, and fully configurable.

---

## Long-Term Vision

Version 1 is only the foundation.

Future versions should allow the platform to evolve into a complete digital ecosystem for custom furniture by supporting:

- Multiple businesses.
- Multiple showrooms.
- Mobile applications.
- AI-powered interior design.
- Augmented Reality.
- ERP integration.
- Inventory management.
- Advanced analytics.
- Additional business services.

The architecture should support this evolution without compromising the simplicity of the initial product.

---

## Success Criteria

The project will be considered successful when:

- Customers can confidently design and order custom furniture.
- The manager can operate the business entirely through the platform.
- The ordering process is transparent and easy to follow.
- Customers trust the platform throughout the entire journey.
- The platform delivers a premium experience on both desktop and mobile.
- The architecture remains maintainable, scalable, and ready for future growth.

---

## Guiding Statement

**بيتي بذوقي is not simply a furniture website.**

It is a digital furniture atelier that combines craftsmanship, personalization, transparency, and modern technology to help customers create homes that reflect their own style and personality.

Every future decision should strengthen this vision.

If a feature, design choice, or technical decision does not contribute to this goal, it should be reconsidered.

---
