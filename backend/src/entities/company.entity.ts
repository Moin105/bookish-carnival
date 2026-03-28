import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  vatNumber: string;

  /** Commercial Registration (CR) number */
  @Column({ type: 'varchar', length: 100, nullable: true })
  commercialRegistration: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streetName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  buildingNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  plotIdentification: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  citySubdivisionName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  website: string;

  @Column({ type: 'text', nullable: true })
  logo: string; // Base64 encoded logo

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
