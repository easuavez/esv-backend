import { User, PersonalInfo } from './model/user.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import UserCreated from './events/UserCreated';
import UserUpdated from './events/UserUpdated';
import { ClientService } from '../client/client.service';
import { UserType } from './model/user-type.enum';

export class UserService {
  constructor(
  @InjectRepository(User)
    private userRepository = getRepository(User),
    private clientService: ClientService
  ) {}

  public async getUserById(id: string): Promise<User> {
    return await this.userRepository.findById(id);
  }

  public async getUsers(): Promise<User[]> {
    return await this.userRepository.find();
  }

  public async createUser(name?: string, phone?: string, email?: string, commerceId?: string, queueId?: string, lastName?: string, idNumber?: string, notificationOn?: boolean, notificationEmailOn?: boolean, personalInfo?: PersonalInfo): Promise<User> {
    let user = new User();
    if (name) {
      user.name = name;
    }
    if (lastName) {
      user.lastName = lastName;
    }
    if (idNumber) {
      user.idNumber = idNumber;
    }
    if (phone) {
      user.phone = phone;
    }
    if (email) {
      user.email = email;
    }
    if (commerceId) {
      user.commerceId = commerceId;
    }
    if (queueId) {
      user.queueId = queueId;
    }
    if (notificationOn !== undefined) {
      user.notificationOn = notificationOn;
    }
    if (notificationEmailOn !== undefined) {
      user.notificationEmailOn = notificationEmailOn;
    }
    if (personalInfo !== undefined) {
      user.personalInfo = personalInfo;
    }
    user.type = UserType.STANDARD;
    user.frequentCustomer = false;
    user.createdAt = new Date();
    const userCreated = await this.userRepository.create(user);
    const userCreatedEvent = new UserCreated(new Date(), userCreated);
    publish(userCreatedEvent);
    await this.clientService.saveClient(
      user.name,
      user.phone,
      user.email,
      user.lastName,
      user.idNumber,
      user.personalInfo
    );
    return userCreated;
  }

  public async updateUser(user: string, id: string, name?: string, phone?: string, email?: string, commerceId?: string, queueId?: string, lastName?: string, idNumber?: string, notificationOn?: boolean, notificationEmailOn?: boolean, personalInfo?: PersonalInfo): Promise<User> {
    try {
      let userById = await this.userRepository.findById(id);
      if (name) {
        userById.name = name;
      }
      if (lastName) {
        userById.lastName = lastName;
      }
      if (idNumber) {
        userById.idNumber = idNumber;
      }
      if (phone) {
        userById.phone = phone;
      }
      if (email) {
        userById.email = email;
      }
      if (commerceId) {
        userById.commerceId = commerceId;
      }
      if (queueId) {
        userById.queueId = queueId;
      }
      if (notificationOn !== undefined) {
        userById.notificationOn = notificationOn;
      }
      if (notificationEmailOn !== undefined) {
        userById.notificationEmailOn = notificationEmailOn;
      }
      if (personalInfo !== undefined) {
        userById.personalInfo = personalInfo;
      }
      const userUpdated = await this.userRepository.update(userById);
      const userUpdatedEvent = new UserUpdated(new Date(), userUpdated, { user });
      publish(userUpdatedEvent);
      return userUpdated;
    } catch (error) {
      throw `Hubo un problema al modificar el usuario: ${error.message}`;
    }
  }

  public async update(user: string, userById: User): Promise<User> {
    const userUpdated = await this.userRepository.update(userById);
    const userUpdatedEvent = new UserUpdated(new Date(), userUpdated, { user });
    publish(userUpdatedEvent);
    await this.clientService.saveClient(
      userById.name,
      userById.phone,
      userById.email,
      userById.lastName,
      userById.idNumber,
      userById.personalInfo
    );
    return userUpdated;
  }
}
